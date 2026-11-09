import { TextDecoder } from "node:util";
import QRCode from "qrcode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolSandbox } from "~/components/tool/tool-sandbox";
import { OfficialToolQrcodeScanner } from "./def";

/** Render genuine QR modules into RGBA pixels without depending on a native canvas. */
function makeQrPixels(data: Parameters<typeof QRCode.create>[0], inverted = false) {
  const qr = QRCode.create(data);
  const scale = 6;
  const border = 4;
  const width = (qr.modules.size + border * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const row = Math.floor(y / scale) - border;
      const col = Math.floor(x / scale) - border;
      const dark = row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col);
      const color = Boolean(dark) !== inverted ? 0 : 255;
      pixels.set([color, color, color, 255], (y * width + x) * 4);
    }
  }
  return { data: pixels, width, height: width };
}

/** Stub browser image loading while retaining the real sandbox, loader, and QR decoder. */
function createScanner(pixels = makeQrPixels("Test"), failImage = false) {
  const revokeObjectURL = vi.fn();
  const createObjectURL = vi.fn(() => "blob:qr-test");
  class ImageStub {
    naturalWidth = pixels.width;
    naturalHeight = pixels.height;
    onload?: () => void;
    onerror?: () => void;
    set src(_value: string) {
      queueMicrotask(() => failImage ? this.onerror?.() : this.onload?.());
    }
  }
  class TestURL extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("Image", ImageStub);
  vi.stubGlobal("URL", TestURL);
  vi.stubGlobal("TextDecoder", TextDecoder);
  const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn(), getImageData: vi.fn(() => pixels) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,cHJldmlldw==");
  const sandbox = new ToolSandbox(OfficialToolQrcodeScanner, { console: { log: vi.fn() } });
  const callback = vi.fn();
  const file = new File(["image pixels are supplied by the canvas stub"], "qr.png", { type: "image/png" });
  return { sandbox, callback, file, revokeObjectURL, createObjectURL };
}

afterEach(() => vi.unstubAllGlobals());

describe("QR Code Scanner", () => {
  it("preserves Unicode, whitespace, and literal HTML in the text output", async () => {
    const text = '  中文 日本語 👋\n<img src=x onerror="alert(1)">  ';
    const { sandbox, callback, file, revokeObjectURL } = createScanner(makeQrPixels(text));
    const result = await sandbox.executeHandler({ qr_image: file }, "qr_image", callback);
    expect(result?.qr_text).toBe(text);
    expect(result?.qr_status).not.toContain("<img");
    expect(result?.qr_base64).toBe(Buffer.from(text).toString("base64"));
    expect(JSON.parse(result?.qr_details as string).bytes).toEqual(Array.from(Buffer.from(text)));
    expect(callback).toHaveBeenCalledWith({ qr_status: "", qr_text: "", qr_hex: "", qr_base64: "", qr_details: "", qr_preview: "" });
    expect(callback).toHaveBeenCalledWith({ qr_preview: expect.stringContaining('src="data:image/png;base64,cHJldmlldw=="') });
    expect(result).not.toHaveProperty("qr_preview");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:qr-test");
  });

  it("retains binary segments even when jsQR cannot convert them to a string", async () => {
    const bytes = Buffer.from([0x00, 0xff, 0x80, 0xc3, 0x28]);
    const data: Parameters<typeof QRCode.create>[0] = [{ mode: "numeric", data: "123" }, { mode: "byte", data: bytes }];
    const { sandbox, callback, file } = createScanner(makeQrPixels(data));
    const result = await sandbox.executeHandler({ qr_image: file }, "qr_image", callback);
    const payload = Buffer.concat([Buffer.from("123"), bytes]);
    expect(result?.qr_text).toBe("123\\x00\\xFF\\x80\\xC3\\x28");
    expect(result?.qr_hex).toBe("31 32 33 00 FF 80 C3 28");
    expect(result?.qr_base64).toBe(payload.toString("base64"));
    expect(result?.qr_status).toContain(`href="data:application/octet-stream;base64,${payload.toString("base64")}"`);
    const details = JSON.parse(result?.qr_details as string);
    expect(details.bytes).toEqual(Array.from(payload));
    expect(details.segments).toHaveLength(2);
    expect(details.warnings.join(" ")).toContain("not valid utf-8");
  });

  it("makes NUL and control bytes visible while retaining line breaks and tabs", async () => {
    const bytes = Buffer.from("\x00hello\x1b\n\t");
    const { sandbox, callback, file } = createScanner(makeQrPixels([{ mode: "byte", data: bytes }]));
    const result = await sandbox.executeHandler({ qr_image: file }, "qr_image", callback);
    expect(result?.qr_text).toBe("\\u0000hello\\u001b\n\t");
    expect(result?.qr_base64).toBe(bytes.toString("base64"));
  });

  it("lets users read legacy encodings without changing the payload", async () => {
    const bytes = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);
    const { sandbox, callback, file } = createScanner(makeQrPixels([{ mode: "byte", data: bytes }]));
    const binary = await sandbox.executeHandler({ qr_image: file }, "qr_image", callback);
    const decoded = await sandbox.executeHandler({ qr_image: file, qr_encoding: "gb18030" }, "qr_encoding", callback);
    expect(decoded?.qr_text).toBe("中文");
    expect(decoded?.qr_base64).toBe(binary?.qr_base64);
    expect(decoded?.qr_hex).toBe(binary?.qr_hex);
  });

  it("uses actual Latin-1 rather than Windows-1252 for C1 bytes", async () => {
    const { sandbox, callback, file } = createScanner(makeQrPixels([{ mode: "byte", data: Buffer.from([0x80, 0x9f, 0xe9]) }]));
    const result = await sandbox.executeHandler({ qr_image: file, qr_encoding: "iso-8859-1" }, "qr_encoding", callback);
    expect(result?.qr_text).toBe("\\u0080\\u009fé");
    expect(result?.qr_hex).toBe("80 9F E9");
  });

  it("scans inverted QR codes", async () => {
    const { sandbox, callback, file } = createScanner(makeQrPixels("Inverted QR", true));
    const result = await sandbox.executeHandler({ qr_image: file }, "qr_image", callback);
    expect(result?.qr_text).toBe("Inverted QR");
  });

  it("clears results for blank images and empty inputs", async () => {
    const pixels = { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 };
    const { sandbox, callback, file } = createScanner(pixels);
    const result = await sandbox.executeHandler({ qr_image: file }, "qr_image", callback);
    expect(result?.qr_status).toContain("No readable QR code found");
    expect(result?.qr_text).toBe("");
    expect(result?.qr_details).toBe("");
    expect(callback).toHaveBeenCalledWith({ qr_preview: expect.stringContaining("<img ") });
    expect(result).not.toHaveProperty("qr_preview");
    const empty = await sandbox.executeHandler({}, undefined, callback);
    expect(empty?.qr_status).toContain("Upload or paste an image");
    expect(empty?.qr_base64).toBe("");
    expect(empty?.qr_preview).not.toContain("<img");
  });

  it("cleans up failed image loads and propagates the error", async () => {
    const { sandbox, callback, file, revokeObjectURL } = createScanner(undefined, true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sandbox.executeHandler({ qr_image: file }, "qr_image", callback)).rejects.toThrow("image could not be read");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:qr-test");
    expect(callback).toHaveBeenCalled();
  });

  it("rejects pasted non-image files before allocating image resources", async () => {
    const { sandbox, callback, createObjectURL } = createScanner();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sandbox.executeHandler({ qr_image: new File(["plain text"], "clipboard.txt", { type: "text/plain" }) }, "qr_image", callback)).rejects.toThrow("image file");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });
});
