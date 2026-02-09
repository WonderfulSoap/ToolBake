
/** Embedded package configuration with loader and npmjs URL */
export interface EmbeddedPackageConfig {
  load: () => Promise<any>;
  url : string;
}

export const EMBEDDED_PACKAGES: Record<string, EmbeddedPackageConfig> = {
  "crypto-js"                : { load: () => import("crypto-js"), url: "https://www.npmjs.com/package/crypto-js" },
  "uuid"                     : { load: () => import("uuid"), url: "https://www.npmjs.com/package/uuid" },
  "ulid"                     : { load: () => import("ulid"), url: "https://www.npmjs.com/package/ulid" },
  "dayjs"                    : { load: () => import("dayjs"), url: "https://www.npmjs.com/package/dayjs" },
  "dayjs/plugin/relativeTime": { load: () => import("dayjs/plugin/relativeTime"), url: "https://www.npmjs.com/package/dayjs" },
  "dayjs/plugin/duration"    : { load: () => import("dayjs/plugin/duration"), url: "https://www.npmjs.com/package/dayjs" },
  "colorjs.io"               : { load: () => import("colorjs.io"), url: "https://www.npmjs.com/package/colorjs.io" },
  "change-case"              : { load: () => import("change-case"), url: "https://www.npmjs.com/package/change-case" },
  "chardet"                  : { load: () => import("chardet"), url: "https://www.npmjs.com/package/chardet" },
  "fast-xml-parser"          : { load: () => import("fast-xml-parser"), url: "https://www.npmjs.com/package/fast-xml-parser" },
  "iconv-lite"               : { load: () => import("iconv-lite"), url: "https://www.npmjs.com/package/iconv-lite" },
  "js-yaml"                  : { load: () => import("js-yaml"), url: "https://www.npmjs.com/package/js-yaml" },
  "toml"                     : { load: () => import("toml"), url: "https://www.npmjs.com/package/toml" },
  "markdown-it"              : { load: () => import("markdown-it"), url: "https://www.npmjs.com/package/markdown-it" },
  "jsonpath-plus"            : { load: () => import("jsonpath-plus"), url: "https://www.npmjs.com/package/jsonpath-plus" },
  "jsonata"                  : { load: () => import("jsonata"), url: "https://www.npmjs.com/package/jsonata" },
  "csv-parse"                : { load: () => import("csv-parse/browser/esm"), url: "https://www.npmjs.com/package/csv-parse" },
  "qrcode"                   : { load: () => import("qrcode"), url: "https://www.npmjs.com/package/qrcode" },
  "sql-formatter"            : { load: () => import("sql-formatter"), url: "https://www.npmjs.com/package/sql-formatter" },
  "ip-address"               : { load: () => import("ip-address"), url: "https://www.npmjs.com/package/ip-address" },
  "node-forge"               : { load: () => import("node-forge"), url: "https://www.npmjs.com/package/node-forge" },
  "ffmpeg"                   : { load: () => import("@ffmpeg/ffmpeg"), url: "https://www.npmjs.com/package/@ffmpeg/ffmpeg" },
  "7z-wasm"                  : { load: () => import("7z-wasm"), url: "https://www.npmjs.com/package/7z-wasm" },
  "7z-worker"                : { load: () => import("../workers/7z-worker-package"), url: "" },
  "decimal.js"               : { load: () => import("decimal.js"), url: "https://www.npmjs.com/package/decimal.js" },
  "image-magick"             : { load: () => import("@imagemagick/magick-wasm"), url: "https://www.npmjs.com/package/@imagemagick/magick-wasm" },
  "@imagemagick/magick-wasm" : { load: () => import("@imagemagick/magick-wasm"), url: "https://www.npmjs.com/package/@imagemagick/magick-wasm" },
  "handlebars"               : { load: () => import("handlebars"), url: "https://www.npmjs.com/package/handlebars" },
};


/** Generate a markdown table summarizing all embedded packages */
export function getEmbeddedPackagesMdTable(): string {
  const header = "| Package Name | Package ProjectURL | usage |\n| --- | --- | --- |";
  const rows = Object.entries(EMBEDDED_PACKAGES).map(([name, config]) => {
    const url = config.url || "Internal implementation package";
    return `| ${name} | ${url} | requirePackage("${name}") |`;
  });
  return [header, ...rows].join("\n");
}

export function getEmbeddedPackageDTsDef() : string {
  const embeddedPackagesUnion = Object.keys(EMBEDDED_PACKAGES).map(pkg => `"${pkg}"`).join(" | ");
  return `declare type SupportedEmbedPkg = ${embeddedPackagesUnion || "never"};
/**
 * Dynamically load a package at runtime.
 *
 * Supports two formats:
 * 1. Embedded packages: requirePackage("crypto-js")
 * 2. URL (ESM only): requirePackage("https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/+esm")
 *
 * Note: Online packages must be ESM format. Use jsDelivr's "+esm" suffix for automatic conversion.
 */
declare const requirePackage: (pkg: SupportedEmbedPkg | \`https://\${string}\`) => Promise<any>;`;
}
