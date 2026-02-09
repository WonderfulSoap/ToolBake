import { readdir, rename, stat } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";

const BUILD_DIR = path.resolve(import.meta.dirname, "../build/client");

const SKIP_EXTENSIONS = new Set([".html", ".gz", ".br", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff2", ".woff", ".ttf", ".eot"]);
const MIN_SIZE = 1024; // Only compress files > 1 KB

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function compressFile(filePath: string): Promise<{ saved: number }> {
  const original = await stat(filePath);
  const gzPath = filePath + ".gz";

  await pipeline(
    createReadStream(filePath),
    createGzip({ level: 9 }),
    createWriteStream(gzPath),
  );

  const compressed = await stat(gzPath);
  await rename(gzPath, filePath);
  return { saved: original.size - compressed.size };
}

async function main() {
  console.log(`Compressing build artifacts in ${BUILD_DIR} ...`);

  let totalFiles = 0;
  let totalSaved = 0;
  let skipped = 0;

  for await (const filePath of walkDir(BUILD_DIR)) {
    const ext = path.extname(filePath).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) {
      skipped++;
      continue;
    }

    const fileSize = (await stat(filePath)).size;
    if (fileSize < MIN_SIZE) {
      skipped++;
      continue;
    }

    const { saved } = await compressFile(filePath);
    totalFiles++;
    totalSaved += saved;

    const rel = path.relative(BUILD_DIR, filePath);
    const originalSize = (await stat(filePath)).size;
    const compressedSize = originalSize - saved;
    const ratio = originalSize > 0 ? ((compressedSize / originalSize) * 100).toFixed(1) : "0";
    console.log(`  ${rel}  ${formatSize(originalSize)} → ${formatSize(compressedSize)} (${ratio}%)`);
  }

  console.log(`\nDone! Compressed ${totalFiles} files, saved ${formatSize(totalSaved)} total. (${skipped} files skipped)`);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

main().catch((err) => {
  console.error("Compress failed:", err);
  process.exit(1);
});
