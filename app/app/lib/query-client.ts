import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

/**
 * Rethrow error asynchronously so it can be caught by global unhandledrejection listener.
 * This bridges React Query's internal error handling with global error reporting.
 */
function rethrowAsUnhandled(error: unknown): void {
  queueMicrotask(() => { throw error; });
}

/**
 * Global QueryClient instance for the entire application.
 * Configured with minimal caching strategy and global error handling.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => rethrowAsUnhandled(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => rethrowAsUnhandled(error),
  }),
  defaultOptions: {
    queries: {
      staleTime           : 0, // Always revalidate on mount
      gcTime              : 5 * 60 * 1000, // Clear unused cache after 5 minutes
      retry               : 1,
      refetchOnWindowFocus: false,
    },
  },
});
