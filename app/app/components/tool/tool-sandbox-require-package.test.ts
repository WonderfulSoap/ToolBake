import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolSandboxRequirePackage } from "~/components/tool/tool-sandbox-require-package";

const loadFfmpeg = vi.hoisted(() => vi.fn());
const loadDemo = vi.hoisted(() => vi.fn());
const load7Zip = vi.hoisted(() => vi.fn());
const loadImageMagick = vi.hoisted(() => vi.fn());

vi.mock("~/config/embedded-packages", () => {
  return {
    EMBEDDED_PACKAGES: {
      ffmpeg        : { load: loadFfmpeg },
      demo          : { load: loadDemo },
      "7z-wasm"     : { load: load7Zip },
      "image-magick": { load: loadImageMagick },
    },
  };
});

describe("ToolSandboxRequirePackage.create", function () {
  beforeEach(function () {
    loadFfmpeg.mockReset();
    loadDemo.mockReset();
    load7Zip.mockReset();
    loadImageMagick.mockReset();
  });

  it("wraps ffmpeg to expose load helpers with asset URLs", async function () {
    // Verify wrapper forwards expected asset URLs to FFmpeg.load.
    const loadSpy = vi.fn().mockResolvedValue("ok");
    class MockFFmpeg {
      load = loadSpy;
    }
    loadFfmpeg.mockResolvedValue({ FFmpeg: MockFFmpeg });
    const requirePackage = new ToolSandboxRequirePackage().requirePackageFactory();

    const ffmpegModule = await requirePackage("ffmpeg");
    const instance = new ffmpegModule.FFmpeg();

    await instance.load_ffmpeg();
    expect(loadSpy).toHaveBeenCalledWith({
      coreURL       : expect.stringContaining("/assets/ffmpeg/core/esm/ffmpeg-core.js"),
      wasmURL       : expect.stringContaining("/assets/ffmpeg/core/esm/ffmpeg-core.wasm"),
      classWorkerURL: expect.stringContaining("/assets/ffmpeg/ffmpeg-worker.js"),
    });
    await instance.load_ffmpeg_mt();
    expect(loadSpy).toHaveBeenCalledWith({
      coreURL       : expect.stringContaining("/assets/ffmpeg/core-mt/esm/ffmpeg-core.js"),
      wasmURL       : expect.stringContaining("/assets/ffmpeg/core-mt/esm/ffmpeg-core.wasm"),
      workerURL     : expect.stringContaining("/assets/ffmpeg/core-mt/esm/ffmpeg-core.worker.js"),
      classWorkerURL: expect.stringContaining("/assets/ffmpeg/ffmpeg-worker.js"),
    });
  });

  it("caches loaded modules and skips duplicate loads", async function () {
    // Ensure repeated calls return cached module without reloading.
    const moduleValue = { name: "demo" };
    loadDemo.mockResolvedValue({ default: moduleValue });
    const requirePackage = new ToolSandboxRequirePackage().requirePackageFactory();

    const first = await requirePackage("demo");
    const second = await requirePackage("demo");

    expect(first).toBe(moduleValue);
    expect(second).toBe(moduleValue);
    expect(loadDemo).toHaveBeenCalledTimes(1);
  });

  it("throws when package is not supported", async function () {
    // Validate unsupported packages throw a clear error message.
    const requirePackage = new ToolSandboxRequirePackage().requirePackageFactory();

    await expect(requirePackage("not-supported")).rejects.toThrow(
      "Dynamic require package fail: package \"not-supported\" is not supported for dynamic loading.",
    );
  });

  it("wraps 7z-wasm to inject locateFile defaults", async function () {
    // Ensure default locateFile points wasm loads to the hosted asset.
    const factory = vi.fn().mockReturnValue("7z-instance");
    load7Zip.mockResolvedValue({ default: factory });
    const requirePackage = new ToolSandboxRequirePackage().requirePackageFactory();

    const moduleFactory = await requirePackage("7z-wasm");
    const instance = moduleFactory({});

    expect(instance).toBe("7z-instance");
    expect(factory).toHaveBeenCalledTimes(1);
    const options = factory.mock.calls[0]?.[0] as { locateFile?: (path: string, scriptDirectory: string) => string };
    expect(options.locateFile?.("7zz.wasm", "/base/")).toContain("/assets/7z/7zz.wasm");
    expect(options.locateFile?.("file.js", "/base/")).toBe("/base/file.js");
  });

  it("wraps image-magick to auto-load wasm bytes", async function () {
    // Validate the default loader fetches wasm and forwards bytes to initializer.
    const initSpy = vi.fn().mockResolvedValue("magick-ready");
    loadImageMagick.mockResolvedValue({ initializeImageMagick: initSpy });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok         : true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(3)),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const requirePackage = new ToolSandboxRequirePackage().requirePackageFactory();

    const magickModule = await requirePackage("image-magick");
    const result = await magickModule.initializeImageMagick();

    expect(result).toBe("magick-ready");
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/assets/imagemagick/magick.wasm"));
    expect(initSpy).toHaveBeenCalledTimes(1);
    const wasmArg = initSpy.mock.calls[0]?.[0];
    expect(wasmArg).toBeInstanceOf(Uint8Array);
    vi.unstubAllGlobals();
  });
});
