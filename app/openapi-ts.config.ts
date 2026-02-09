import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input : "../docs/swagger/swagger.json",
  output: "./app/data/generated-http-client",

  plugins: [
    {
      name : "@hey-api/typescript",
      enums: "javascript",
    },
    {
      name   : "@hey-api/sdk",
      asClass: false,
    },
    {
      name : "@hey-api/transformers",
      dates: true,
    },
  ],
});