## Response Ending
- End every response with "にゃん"

# Language
Use English for comments and other documentation text by default.

## AGENTS.md Editing Rule

When adding or updating content in this AGENTS.md file, keep this file concise: create a detailed document under `prompt/` and only add a short heading with a link here. For example:

```markdown
# Topic Title

See [prompt/topic-guide.md](prompt/topic-guide.md)
```


This is a TypeScript + Vite + React + React Router + Tailwind CSS project. UI components use shadcn/ui.


# Project Language

All code comments and documentation within the codebase must be written in English. However, conversations with me should be conducted in Chinese.

# Project Purpose

This is a developer toolbox where users can create and customize their own tools.


# useContext

When providing Context, use `<ContextXXXX xxxx>` directly instead of `<ContextXXXX.Provider>`.

# Function Definitions

When defining non-inline, non-anonymous functions, use `function xxxx` instead of `const xxxx = () => {}`.


# Keep Lines Compact

Minimize line breaks as much as possible without sacrificing readability, rather than breaking lines unnecessarily. However, single-line `if` statements do not need to be compacted.


# API Client / Domain Repository / Swagger Changes

See [prompt/api-client-guide.md](prompt/api-client-guide.md)


# Unit Testing

Unit tests use vitest. API request mocking uses msw.

# Comments

When writing code, you must also provide corresponding code comments, including function definition comments.
Comments should not be written arbitrarily — they must align with the purpose of the changes requested by the user and accurately reflect the intent of the modifications.

# Tool Execution, Sandbox & UI Rendering

See [prompt/tool-execution-architecture.md](prompt/tool-execution-architecture.md)

# Unified Error Handling & UI Display

The project has two layers of unified error handling:

1. **Global JS Errors / Unhandled Promises**: Captured in `app/routes/t.$toolId.tsx` via `window.addEventListener("error")` and `window.addEventListener("unhandledrejection")`. All errors flow through `reportError` and are displayed as toast notifications in the top-right corner of the page; the display strategy differs depending on whether it is an API error.
2. **Route-Level Error Fallback**: The `ErrorBoundary` in `app/root.tsx` provides a unified fallback render for uncaught rendering errors or unhandled route exceptions.

## Force Logout Error Handling

- **Detection Rule**: `ErrorChecker.isLogoutErrorMessage(message)` (in `app/lib/utils.ts`) identifies error messages prefixed with `Logout:`.
- **Trigger Point**: When the global error listener captures a `Logout:` error, it invokes `forceLogout` to perform a forced logout.
- **forceLogout Behavior**: `AuthHelper.forceLogout()` clears the token and wipes all local data in `localStorage`, handling unrecoverable login states such as expired refresh tokens.

## Local try/catch Conventions

- **Bubble Up First**: `ErrorHandler.processError(error)` in `app/error/error-checker.ts` re-throws errors when it detects an expired refresh token or a force-logout condition, allowing the global listener to handle them. It must be called at the beginning of any local `catch` block to avoid swallowing these errors (e.g., tool list load/save/delete, login/logout, global script read/write).
- **Compatible with Error and String**: `isForceLogoutErrorMessage` recognizes both plain strings and `Error.message` values prefixed with `Logout:`, ensuring all exception types can trigger a logout.
- **Bubble Then Fallback**: `processError` only re-throws errors that need to bubble up; all other errors continue through local notification, degradation, or fallback logic.


# React Query Data Management

See [prompt/react-query-guide.md](prompt/react-query-guide.md)
