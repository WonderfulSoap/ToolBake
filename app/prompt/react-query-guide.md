# React Query Data Management Guide

This project uses `@tanstack/react-query` for server-state caching and management.

## Architecture

### File Structure

```
app/
├── lib/
│   └── query-client.ts          # Global QueryClient instance
├── hooks/
│   ├── use-tools.ts             # Tool-related query/mutation hooks
│   ├── use-global-script.ts     # Global script query/mutation hooks
│   ├── use-auth.ts              # Auth-related query/mutation hooks
│   └── use-settings.ts          # Settings query/mutation hooks
├── components/
│   └── header/
│       └── settings-dialog.tsx  # Inline queries/mutations (SSO, passkeys, 2FA)
└── routes/
    └── _layout.tsx              # QueryClientProvider setup
```

### Global QueryClient Instance

**File**: `app/lib/query-client.ts`

The project uses a **single global `queryClient` instance** instead of obtaining it via `useQueryClient()` in each hook. This is because:
- The app is client-side only (no SSR)
- Single-instance application, no need for multiple QueryClients
- Reduces boilerplate (no `useQueryClient()` call in every mutation hook)

```typescript
import { queryClient } from "~/lib/query-client";

// Use the global instance directly in mutation onSuccess callbacks
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
}
```

`QueryClientProvider` is still required in `_layout.tsx` because `useQuery`/`useMutation` internally rely on React Context to access the client.

### Global Error Bridging

The `queryClient` is configured with `QueryCache` and `MutationCache` global `onError` handlers that rethrow errors asynchronously via `queueMicrotask`. This bridges React Query errors to the global `unhandledrejection` listener, ensuring all errors flow through the unified error reporting system.

```typescript
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => rethrowAsUnhandled(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => rethrowAsUnhandled(error),
  }),
  ...
});
```

### Default Cache Configuration

```typescript
defaultOptions: {
  queries: {
    staleTime           : 0,             // Always revalidate on mount
    gcTime              : 5 * 60 * 1000, // Clear unused cache after 5 minutes
    retry               : 1,             // Retry once on failure
    refetchOnWindowFocus: false,         // No auto-refetch on window focus
  },
}
```

## Query Key Registry

All query keys used in the project:

| Query Key | Hook / Location | Description |
|-----------|----------------|-------------|
| `["tools", "official"]` | `useOfficialTools()` | Official tool list |
| `["tools", "user", mode]` | `useUserTools()` | User tool list (re-fetches on auth mode change) |
| `["globalScript"]` | `useGlobalScript()` | Global script content |
| `["settings"]` | `useSettings()` | User settings |
| `["user", "info", mode]` | `useUserInfo()` | User profile info (only when logged in) |
| `["user", "sso", "bindings"]` | `settings-dialog.tsx` | SSO provider bindings |
| `["user", "passkeys"]` | `settings-dialog.tsx` | Registered passkeys |
| `["user", "2fa", "list"]` | `settings-dialog.tsx` | 2FA authenticator list |

## Hook Pattern

### Query Hook

```typescript
export function useOfficialTools() {
  return useQuery({
    queryKey: ["tools", "official"],
    queryFn : async () => {
      try {
        return await globalDI.toolRepository.fetchOfficialTools();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
  });
}
```

Key conventions:
- `queryFn` wraps the call in `try/catch`, calling `ErrorHandler.processError(error)` first, then re-throwing
- Data is fetched via `globalDI` (dependency injection)
- Include dynamic state (e.g. auth `mode`) in `queryKey` to trigger auto-refetch on state change
- Use `enabled` option for conditional queries (e.g. `useUserInfo` only fetches when logged in)

### Composite Query Hook

`useToolList()` composes `useOfficialTools()` and `useUserTools()`, merging results with `useMemo`:

```typescript
export function useToolList() {
  const { data: officialTools = [], isLoading: isLoadingOfficial } = useOfficialTools();
  const { data: userTools = [], isLoading: isLoadingUser } = useUserTools();
  const toolList = useMemo(() => [...officialTools, ...userTools], [officialTools, userTools]);
  return { data: toolList, officialTools, userTools, isLoading: isLoadingOfficial || isLoadingUser, ... };
}
```

### Mutation Hook

```typescript
export function useDeleteUserTool() {
  return useMutation({
    mutationFn: async (uid: string) => {
      try {
        return await globalDI.toolRepository.deleteUserTool(uid);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}
```

Key conventions:
- Use the global `queryClient` for cache invalidation in `onSuccess`
- Prefix `invalidateQueries` with `void` (fire-and-forget)
- Invalidate by partial key prefix to match all related queries

### Invalidate vs Remove

- **`invalidateQueries`**: Marks queries as stale and triggers a background refetch. Used after create/update/delete operations (e.g. login, tool CRUD).
- **`removeQueries`**: Completely removes query data from the cache. Used on logout to clear sensitive user data immediately.

```typescript
// Login: invalidate to refetch
void queryClient.invalidateQueries({ queryKey: ["user"] });

// Logout: remove to clear data
queryClient.removeQueries({ queryKey: ["user"] });
queryClient.removeQueries({ queryKey: ["tools", "user"] });
```

## Adding New Server Data

When adding a new domain that needs server-state management:

1. **Create a hook file** in `app/hooks/use-<domain>.ts`
2. **Define query hooks** using the pattern above (with `ErrorHandler.processError` in catch)
3. **Define mutation hooks** that invalidate related query keys on success
4. **Register query keys** following the hierarchical naming convention (e.g. `["domain", "sub-resource", ...dynamic]`)
5. **Use the global `queryClient`** import for invalidation in mutations (not `useQueryClient()`)

For small, component-scoped queries that don't need reuse (e.g. settings dialog sub-panels), inline `useQuery`/`useMutation` directly in the component is acceptable.

## Testing

Since the project uses a global `queryClient`, clear cache between tests:

```typescript
import { queryClient } from "~/lib/query-client";

beforeEach(() => {
  queryClient.clear();
});
```

Or use a test-scoped QueryClient wrapper:

```typescript
function TestWrapper({ children }) {
  const testClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={testClient}>{children}</QueryClientProvider>;
}
```
