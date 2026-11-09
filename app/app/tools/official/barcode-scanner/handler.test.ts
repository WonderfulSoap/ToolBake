import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolSandbox } from "~/components/tool/tool-sandbox";
import { OfficialToolBarcodeGenerator } from "../barcode-generator/def";
import { OfficialToolBarcodeScanner } from "./def";

type Pixels = { data: Uint8ClampedArray; width: number; height: number };
let imagePixels: Pixels;
let failImage: boolean;
const callback = vi.fn();
const revokeObjectURL = vi.fn();
const wasmBytes = readFileSync(createRequire(import.meta.url).resolve("zxing-wasm/reader/zxing_reader.wasm"));

/** Read the actual SVG exported by the generator for independent image decoding. */
function readGeneratedSvg(result: Record<string, unknown> | undefined) {
  const preview = document.createElement("div");
  preview.innerHTML = String(result?.barcode_preview);
  const source = preview.querySelector("img")?.getAttribute("src");
  expect(source).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  const svg = new DOMParser().parseFromString(decodeURIComponent(source!.split(",").slice(1).join(",")), "image/svg+xml");
  expect(svg.querySelector("parsererror")).toBeNull();
  return svg;
}

/** Rasterize exported SVG bar rectangles without adding a native canvas dependency. */
function rasterizeBarcode(svg: Document): Pixels {
  const [, , width, height] = svg.documentElement.getAttribute("viewBox")!.split(" ").map(Number);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const rect of svg.querySelectorAll("g rect")) {
    const group = rect.parentElement!;
    const translation = group.getAttribute("transform")!.match(/translate\((\d+),\s*(\d+)\)/)!;
    const left = Number(rect.getAttribute("x")) + Number(translation[1]);
    const top = Number(rect.getAttribute("y")) + Number(translation[2]);
    const barWidth = Number(rect.getAttribute("width"));
    const barHeight = Number(rect.getAttribute("height"));
    for (let y = top; y < top + barHeight; y++) {
      for (let x = left; x < left + barWidth; x++) data.set([0, 0, 0, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

/** Rotate image pixels independently of the scanner to exercise portrait barcodes. */
function rotatePixels(pixels: Pixels): Pixels {
  const width = pixels.height;
  const height = pixels.width;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const source = (y * pixels.width + x) * 4;
      const target = (x * width + width - y - 1) * 4;
      data.set(pixels.data.subarray(source, source + 4), target);
    }
  }
  return { data, width, height };
}

/** Exercise the production sandbox and package loader with captured diagnostic logs. */
function sandboxFor(tool: typeof OfficialToolBarcodeGenerator) {
  return new ToolSandbox(tool, { console: { log: vi.fn() } });
}

/** Supply browser APIs while the real barcode libraries encode and decode the images. */
beforeEach(() => {
  imagePixels = { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 };
  failImage = false;
  callback.mockClear();
  revokeObjectURL.mockClear();
  class ImageStub {
    naturalWidth = imagePixels.width;
    naturalHeight = imagePixels.height;
    onload?: () => void;
    onerror?: () => void;
    set src(_value: string) {
      queueMicrotask(() => failImage ? this.onerror?.() : this.onload?.());
    }
  }
  class TestURL extends URL {
    static createObjectURL = vi.fn(() => "blob:barcode-test");
    static revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("Image", ImageStub);
  vi.stubGlobal("URL", TestURL);
  // Load the real WASM through the package loader's bundled URL without network access.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(Uint8Array.from(wasmBytes), { headers: { "Content-Type": "application/wasm" } })));
  const context = {
    fillStyle: "", font: "", textAlign: "",
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    drawImage: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    getImageData: vi.fn(() => imagePixels),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,dGVzdA==");
});

afterEach(() => vi.unstubAllGlobals());

describe("Barcode Generator and Scanner", () => {
  it.each([
    ["CODE128", "Code128", "  001234Abc  ", "  001234Abc  "],
    ["CODE39", "Code39", "abc123", "ABC123"],
    ["CODE93", "Code93", "ABC123", "ABC123"],
    ["EAN13", "EAN13", "123456789012", "1234567890128"],
    ["EAN8", "EAN8", "1234567", "12345670"],
    ["UPC", "UPCA", "01234567890", "012345678905"],
    ["UPCE", "UPCE", "123450", "01234505"],
    ["ITF", "ITF", "00123456", "00123456"],
    ["ITF14", "ITF", "1001234567890", "10012345678902"],
    ["codabar", "Codabar", "A123456B", "A123456B"],
  ])("generates a valid %s SVG that scans as %s", async (format, detectedFormat, value, expected) => {
    const generated = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: value, barcode_format: format }, "barcode_value", callback);
    const svg = readGeneratedSvg(generated);
    imagePixels = rasterizeBarcode(svg);
    const file = new File(["fixture"], "barcode.png", { type: "image/png" });
    const scanner = sandboxFor(OfficialToolBarcodeScanner);
    const result = await scanner.executeHandler({ barcode_image: file }, "barcode_image", callback);
    expect(result?.barcode_text).toBe(expected);
    expect(JSON.parse(String(result?.barcode_details)).format).toBe(detectedFormat);
    expect(generated?.barcode_download).toContain('download="barcode-');
    expect(generated?.barcode_download).toContain("Download SVG");
    expect(generated?.barcode_download).toContain("Download PNG");
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith("image/png");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:barcode-test");
  });

  it.each(["rotated", "inverted"])("reads %s barcodes", async orientation => {
    const generated = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: "12345678" }, undefined, callback);
    imagePixels = rasterizeBarcode(readGeneratedSvg(generated));
    if (orientation === "rotated") imagePixels = rotatePixels(imagePixels);
    else imagePixels.data = imagePixels.data.map((value, index) => index % 4 === 3 ? value : 255 - value);
    const file = new File(["fixture"], "barcode.png", { type: "image/png" });
    const result = await sandboxFor(OfficialToolBarcodeScanner).executeHandler({ barcode_image: file }, "barcode_image", callback);
    expect(result?.barcode_text).toBe("12345678");
    const details = JSON.parse(String(result?.barcode_details));
    if (orientation === "rotated") expect(Math.abs(details.rotation)).toBe(90);
    else expect(details.inverted).toBe(true);
  });

  it("filters barcode formats and clears previous output on no match", async () => {
    const generated = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: "ABC123" }, undefined, callback);
    imagePixels = rasterizeBarcode(readGeneratedSvg(generated));
    const scanner = sandboxFor(OfficialToolBarcodeScanner);
    const file = new File(["fixture"], "barcode.png", { type: "image/png" });
    const matched = await scanner.executeHandler({ barcode_image: file, barcode_format: "CODE_128" }, "barcode_format", callback);
    expect(matched?.barcode_text).toBe("ABC123");
    const unmatched = await scanner.executeHandler({ barcode_image: file, barcode_format: "EAN_13" }, "barcode_format", callback);
    expect(unmatched?.barcode_status).toContain("No readable supported barcode");
    expect(unmatched?.barcode_text).toBe("");
    expect(unmatched?.barcode_details).toBe("");
  });

  it("lets users choose UPC-A or the equivalent leading-zero EAN-13", async () => {
    const generated = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: "01234567890", barcode_format: "UPC" }, undefined, callback);
    imagePixels = rasterizeBarcode(readGeneratedSvg(generated));
    const file = new File(["fixture"], "barcode.png", { type: "image/png" });
    const scanner = sandboxFor(OfficialToolBarcodeScanner);
    const upca = await scanner.executeHandler({ barcode_image: file, barcode_format: "UPC_A" }, "barcode_format", callback);
    const ean13 = await scanner.executeHandler({ barcode_image: file, barcode_format: "EAN_13" }, "barcode_format", callback);
    expect(upca?.barcode_text).toBe("012345678905");
    expect(ean13?.barcode_text).toBe("0012345678905");
  });

  it("preserves control characters in JSON while escaping them in the text view", async () => {
    const text = "AB\x00CD\tEF";
    const generated = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: text, barcode_display_value: false }, undefined, callback);
    imagePixels = rasterizeBarcode(readGeneratedSvg(generated));
    const file = new File(["fixture"], "barcode.png", { type: "image/png" });
    const result = await sandboxFor(OfficialToolBarcodeScanner).executeHandler({ barcode_image: file }, "barcode_image", callback);
    expect(result?.barcode_text).toBe("AB\\u0000CD\\u0009EF");
    expect(JSON.parse(String(result?.barcode_details)).text).toBe(text);
  });

  it.each([
    ["EAN13", "1234567890123"], ["EAN8", "123"], ["UPC", "012345678901"],
    ["UPCE", "21234567"], ["ITF", "123"], ["ITF14", "10012345678903"],
    ["CODE128", "中文"], ["CODE128", "È"], ["CODE39", "ß"], ["CODE39", "A@B"], ["CODE93", "A@B"], ["codabar", "Z123Z"],
  ])("rejects invalid %s values and removes downloads", async (format, value) => {
    const result = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: value, barcode_format: format }, "barcode_value", callback);
    expect(result?.barcode_preview).toContain("Invalid value");
    expect(result?.barcode_download).toBe("");
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });

  it("applies dimensions and caption options to the SVG", async () => {
    const generator = sandboxFor(OfficialToolBarcodeGenerator);
    const narrow = readGeneratedSvg(await generator.executeHandler({ barcode_value: "00123", barcode_width: 1, barcode_height: 30, barcode_display_value: false }, undefined, callback));
    const wide = readGeneratedSvg(await generator.executeHandler({ barcode_value: "00123", barcode_width: 4, barcode_height: 300 }, "barcode_width", callback));
    expect(narrow.querySelector("text")).toBeNull();
    expect(wide.querySelector("text")?.textContent).toBe("00123");
    expect(Number(narrow.querySelector("g rect")?.getAttribute("height"))).toBe(30);
    expect(Number(wide.querySelector("g rect")?.getAttribute("height"))).toBe(300);
    expect(parseFloat(wide.documentElement.getAttribute("width")!)).toBeGreaterThan(parseFloat(narrow.documentElement.getAttribute("width")!));
  });

  it("renders HTML-like values as SVG text without injecting markup", async () => {
    const value = '<img src=x onerror="alert(1)">';
    const generated = await sandboxFor(OfficialToolBarcodeGenerator).executeHandler({ barcode_value: value }, undefined, callback);
    const svg = readGeneratedSvg(generated);
    expect(svg.querySelector("img, script")).toBeNull();
    expect(svg.querySelector("text")?.textContent).toBe(value);
  });

  it("handles empty inputs and oversized values without retaining results", async () => {
    const generator = sandboxFor(OfficialToolBarcodeGenerator);
    const empty = await generator.executeHandler({}, undefined, callback);
    expect(empty?.barcode_preview).toContain("Enter a value");
    expect(empty?.barcode_download).toBe("");
    const oversized = await generator.executeHandler({ barcode_value: "A".repeat(257) }, "barcode_value", callback);
    expect(oversized?.barcode_preview).toContain("at most 256");
    expect(oversized?.barcode_download).toBe("");
    const scannerEmpty = await sandboxFor(OfficialToolBarcodeScanner).executeHandler({}, undefined, callback);
    expect(scannerEmpty?.barcode_status).toContain("Upload or paste");
    expect(scannerEmpty?.barcode_text).toBe("");
    expect(scannerEmpty?.barcode_preview).not.toContain("<img");
  });

  it("returns a no-match state for blank images", async () => {
    const result = await sandboxFor(OfficialToolBarcodeScanner).executeHandler({ barcode_image: new File(["blank"], "blank.png", { type: "image/png" }) }, "barcode_image", callback);
    expect(result?.barcode_status).toContain("No readable supported barcode");
    expect(result?.barcode_details).toBe("");
    expect(callback).toHaveBeenCalledWith({ barcode_preview: expect.stringContaining('src="data:image/png;base64,dGVzdA=="') });
    expect(result).not.toHaveProperty("barcode_preview");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:barcode-test");
  });

  it("clears stale results and releases object URLs on failed image loads", async () => {
    failImage = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const scanner = sandboxFor(OfficialToolBarcodeScanner);
    const file = new File(["corrupt"], "corrupt.png", { type: "image/png" });
    await expect(scanner.executeHandler({ barcode_image: file }, "barcode_image", callback)).rejects.toThrow("image could not be read");
    expect(callback).toHaveBeenCalledWith({ barcode_status: "", barcode_text: "", barcode_details: "", barcode_preview: "" });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:barcode-test");
  });

  it("rejects non-image clipboard files before creating an object URL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = new File(["text"], "clipboard.txt", { type: "text/plain" });
    await expect(sandboxFor(OfficialToolBarcodeScanner).executeHandler({ barcode_image: file }, "barcode_image", callback)).rejects.toThrow("image containing a barcode");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
