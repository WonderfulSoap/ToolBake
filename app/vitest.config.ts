import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test   : {
    environment: "jsdom",
    globals    : true,
    include    : ["app/**/*.test.{ts,tsx}"],
    setupFiles : ["./vitest.setup.ts"],
    pool       : "threads",
  },
});
