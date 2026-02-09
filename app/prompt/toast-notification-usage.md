# Toast Notification Usage Guide

This project uses `ToastContext` to provide a global bottom-right notification feature, supporting two types: error alerts and general notices.

## Basic Usage

### Import the Hook

```tsx
import { useToastContext } from "~/contexts/toast-context";
```

### Get the Methods

```tsx
const { reportError, reportNotice } = useToastContext();
```

## API Reference

### reportNotice - General Notice

Used to display general informational messages that automatically disappear after 5 seconds.

```tsx
// Display a notice
reportNotice("source-key", "Notification message");

// Clear a notice
reportNotice("source-key", undefined);
```

Parameters:
- `source`: A notice source identifier, used for deduplication and clearing
- `message`: The notice content; pass `undefined` to clear the notice from this source

### reportError - Error Notification

Used to display error messages that automatically disappear after 10 seconds.

```tsx
// Display an error (with popup)
reportError("source-key", "Error message", error, true);

// Display an error (console.error only, no popup)
reportError("source-key", "Error message", error, false);

// Clear an error
reportError("source-key", undefined);
```

Parameters:
- `source`: The error source identifier
- `message`: The error content; pass `undefined` to clear the error from this source
- `error`: Optional, the original error object (used for console.error)
- `showPopup`: Optional, defaults to `true`, whether to show the bottom-right popup

## Usage Examples

### Display a Notice on Page Entry

```tsx
useEffect(() => {
  if (someCondition) {
    reportNotice("my-notice", "This is a notice message");
  }
  // Clear the notice when leaving the page
  return () => { reportNotice("my-notice", undefined); };
}, [someCondition, reportNotice]);
```

### Guest Mode Notice

```tsx
const { mode } = useAuthContext();
const { reportNotice } = useToastContext();

useEffect(() => {
  if (mode === "local") {
    reportNotice("guest-mode", "Guest mode: Changes are saved locally only");
  }
  return () => { reportNotice("guest-mode", undefined); };
}, [mode, reportNotice]);
```

### Display an Error on Operation Failure

```tsx
try {
  await someAsyncOperation();
  reportError("operation", undefined); // Clear the previous error
} catch (error) {
  const message = error instanceof Error ? error.message : "Operation failed";
  reportError("operation", message, error, true);
}
```

## Notes

1. **Source Key Uniqueness**: Notices with the same source will overwrite each other; ensure different features use different source keys
2. **Auto-dismiss**: Notices disappear after 5 seconds, errors after 10 seconds
3. **Cleanup**: Clear related notices when a component unmounts to avoid leftover notifications
4. **Deduplication**: Repeated calls with the same source will not produce multiple notifications

## Related Files

- Context implementation: `app/contexts/toast-context.tsx`
- UI rendering: `app/routes/_layout.tsx` (ToastProvider wrapper + notification list rendering)
