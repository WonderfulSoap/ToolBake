import { Buffer } from "buffer/index.js";

// Match the previous polyfill's global Buffer behavior for dynamically loaded tools.
globalThis.Buffer ??= Buffer as unknown as typeof globalThis.Buffer;

export { Buffer };
