import { EMBEDDED_PACKAGES } from "~/config/embedded-packages";
import {
  MANIFEST_7ZZ_WASM,
  MANIFEST_MAGICK_WASM,
  MANIFEST_FFMPEG_CORE_JS,
  MANIFEST_FFMPEG_CORE_WASM,
  MANIFEST_FFMPEG_WORKER_JS,
  MANIFEST_FFMPEG_CORE_MT_JS,
  MANIFEST_FFMPEG_CORE_MT_WASM,
  MANIFEST_FFMPEG_CORE_MT_WORKER_JS,
} from "~/config/manifest-list";


export class ToolSandboxRequirePackage {

  private cachedModules: Map<string, any> = new Map();

  private specialPackages: Record<string, (module: any) => any> = {
    "ffmpeg"                  : this.wrapFfmpeg,
    "7z-wasm"                 : this.wrap7ZipModule,
    "image-magick"            : this.wrapImageMagickModule,
    "@imagemagick/magick-wasm": this.wrapImageMagickModule,
  };
  constructor(){

  }


  /**
   * Dynamically import an ESM module from a remote URL.
   */
  private async importFromUrl(url: string): Promise<any> {
    try {
      const module = await import(/* @vite-ignore */ url);
      return module;
    } catch (error) {
      throw new Error(`Failed to load remote package from "${url}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  requirePackageFactory(onStart?: (pkg: string) => void, onEnd?: (pkg: string, error?: unknown) => void) {
    // return the requirePackage function with captured onStart and onEnd hooks
    return async (pkg: string): Promise<any> => {
      const cached = this.cachedModules.get(pkg);
      if (cached) return cached;

      onStart?.(pkg);
      let failure: unknown;
      try {
        console.log(`Dynamic require package: "${pkg}"`);

        // Check if it's an online package URL (https://)
        if (pkg.startsWith("https://")) {
          console.log(`Loading remote ESM package from: ${pkg}`);
          const module = await this.importFromUrl(pkg);
          const normalizedModule = module?.default ?? module;
          this.cachedModules.set(pkg, normalizedModule);
          return normalizedModule;
        }

        // Fall back to embedded packages
        const embeddedPkg = EMBEDDED_PACKAGES[pkg];
        if (!embeddedPkg) {
          throw new Error(
            `Package "${pkg}" is not available. Use embedded packages or load from URL:\n` +
            `  - Embedded: ${Object.keys(EMBEDDED_PACKAGES).slice(0, 5).join(", ")}...\n` +
            "  - URL: https://cdn.jsdelivr.net/npm/package@version/+esm"
          );
        }
        let module = await embeddedPkg.load();

        // Special handling for ffmpeg to wrap it with custom loading logic
        if (this.specialPackages[pkg]) {
          module = this.specialPackages[pkg](module);
        }

        // Normalize ESM/CJS default exports so handlers can use requirePackage directly.
        const normalizedModule = module?.default ?? module;
        this.cachedModules.set(pkg, normalizedModule);
        return normalizedModule;
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        onEnd?.(pkg, failure);
      }
    };
  }


  private wrapFfmpeg(module: any) {
    const OriginalFFmpeg = module.FFmpeg;
    function CustomFFmpeg(...args: unknown[]) {
      const instance = new OriginalFFmpeg(...args);
      const originalLoad = typeof instance.load === "function" ? instance.load.bind(instance) : null;
      instance.load_ffmpeg = async function load_ffmpeg() {
        if (!originalLoad) return Promise.reject(new Error("FFmpeg load function is unavailable."));
        return originalLoad({
        // Use public asset URLs so the build stays in sync with node_modules.
          coreURL       : MANIFEST_FFMPEG_CORE_JS,
          wasmURL       : MANIFEST_FFMPEG_CORE_WASM,
          classWorkerURL: MANIFEST_FFMPEG_WORKER_JS,
        });
      };
      instance.load_ffmpeg_mt = async function load_ffmpeg_mt() {
      // Load the multi-threaded core bundle on demand.
        if (!originalLoad) return Promise.reject(new Error("FFmpeg load function is unavailable."));
        return originalLoad({
          coreURL       : MANIFEST_FFMPEG_CORE_MT_JS,
          wasmURL       : MANIFEST_FFMPEG_CORE_MT_WASM,
          workerURL     : MANIFEST_FFMPEG_CORE_MT_WORKER_JS,
          classWorkerURL: MANIFEST_FFMPEG_WORKER_JS,
        });
      };
      return instance;
    }
    Object.setPrototypeOf(CustomFFmpeg, OriginalFFmpeg);
    CustomFFmpeg.prototype = OriginalFFmpeg.prototype;
    return { ...module, FFmpeg: CustomFFmpeg };
  }


  private wrap7ZipModule(module: any) {
    const factory = module?.default ?? module;
    function Custom7Zip(options: Record<string, unknown> = {}) {
      const resolvedOptions = { ...options };
      if (!resolvedOptions.locateFile) {
        resolvedOptions.locateFile = function locateFile(path: string, scriptDirectory: string) {
          if (path && path.endsWith(".wasm")) return MANIFEST_7ZZ_WASM;
          return `${scriptDirectory}${path}`;
        };
      }
      return factory(resolvedOptions);
    }
    if (module?.default) return { ...module, default: Custom7Zip };
    return Custom7Zip;
  }

  private wrapImageMagickModule(module: any) {
    const normalizedModule = module?.default ?? module;
    const originalInit = normalizedModule?.initializeImageMagick;

    function fetchImageMagickWasmBytes(wasmUrl: string) {
      return fetch(wasmUrl).then((response) => {
        if (!response.ok) throw new Error(`Failed to load ImageMagick wasm: ${response.status}`);
        return response.arrayBuffer();
      }).then((buffer) => new Uint8Array(buffer));
    }

    async function initializeImageMagickWithDefaults(
      wasmLocationDataOrAssembly?: URL | Uint8Array | WebAssembly.Module,
      configurationFiles?: unknown
    ) {
      if (typeof originalInit !== "function") {
        throw new Error("ImageMagick initializeImageMagick is unavailable.");
      }
      if (!wasmLocationDataOrAssembly) {
        const wasmBytes = await fetchImageMagickWasmBytes(MANIFEST_MAGICK_WASM);
        return originalInit(wasmBytes, configurationFiles);
      }
      return originalInit(wasmLocationDataOrAssembly, configurationFiles);
    }

    // Expose a default loader while preserving the original API signature.
    return { ...normalizedModule, initializeImageMagick: initializeImageMagickWithDefaults };
  }
}