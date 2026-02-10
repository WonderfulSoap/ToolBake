import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { officialToolsMeta } from "../app/tools/official-tools-meta";

const SITE_URL = "https://toolbake.com";

const urls: string[] = [
  "/",
  "/privacy-policy",
  "/terms-of-service",
];

for (const toolId of Object.keys(officialToolsMeta)) {
  urls.push(`/t/${toolId}`);
}

const today = new Date().toISOString().split("T")[0];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join("\n")}
</urlset>
`;

const outPath = resolve(import.meta.dirname, "../build/client/sitemap.xml");
writeFileSync(outPath, sitemap, "utf-8");
