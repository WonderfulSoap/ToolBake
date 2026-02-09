
/**
 * Centralized manifest for all static assets used in tool sandbox.
 * Each asset is exported individually to enable tree-shaking - only imported assets
 * will be bundled into the final output (e.g., 7z-worker won't include ffmpeg URLs).
 */

// 7-Zip WASM and Worker
export const MANIFEST_7ZZ_WASM     = "/assets/7z/7zz.wasm?c292b4bb";
export const MANIFEST_7Z_WORKER_JS = "/assets/7z/7z-worker.js?8f0a1cb7";

// ImageMagick WASM
export const MANIFEST_MAGICK_WASM = "/assets/imagemagick/magick.wasm?d3834de6";

// FFmpeg single-threaded core
export const MANIFEST_FFMPEG_CORE_JS   = "/assets/ffmpeg/core/esm/ffmpeg-core.js?19d26463";
export const MANIFEST_FFMPEG_CORE_WASM = "/assets/ffmpeg/core/esm/ffmpeg-core.wasm?3730c055";
export const MANIFEST_FFMPEG_WORKER_JS = "/assets/ffmpeg/ffmpeg-worker.js?aab4de16";

// FFmpeg multi-threaded core
export const MANIFEST_FFMPEG_CORE_MT_JS        = "/assets/ffmpeg/core-mt/esm/ffmpeg-core.js?c61207be";
export const MANIFEST_FFMPEG_CORE_MT_WASM      = "/assets/ffmpeg/core-mt/esm/ffmpeg-core.wasm?1da3b289";
export const MANIFEST_FFMPEG_CORE_MT_WORKER_JS = "/assets/ffmpeg/core-mt/esm/ffmpeg-core.worker.js?de8c901b";