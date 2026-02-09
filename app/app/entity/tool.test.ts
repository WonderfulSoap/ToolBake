import { describe, it, expect } from "vitest";
import { resolveToolWidgetValueType, buildToolHandlerDts } from "./tool";
import type { ToolUIWidget, ToolUIRows } from "./tool";

describe("resolveToolWidgetValueType", () => {
  it("should handle SelectListInput with dynamic options", () => {
    const widget: ToolUIWidget = {
      id   : "hash_encoding",
      type : "SelectListInput",
      title: "Hash encoding",
      mode : "input",
      props: {
        placeholder : "Hash encoding",
        defaultValue: "hex",
        options     : [
          { value: "bin", label: "Bin" },
          { value: "hex", label: "Hex" },
          { value: "base64", label: "Base64" },
          { value: "base64_safe", label: "Base64 without =" },
        ],
      },
    };

    const result = resolveToolWidgetValueType(widget);
    expect(result).toBe("\"bin\" | \"hex\" | \"base64\" | \"base64_safe\"");
  });

  it("should handle SelectListInput with empty options", () => {
    const widget: ToolUIWidget = {
      id   : "test",
      type : "SelectListInput",
      title: "Test",
      mode : "input",
      props: {
        options: [],
      },
    };

    const result = resolveToolWidgetValueType(widget);
    expect(result).toBe("string | undefined");
  });

  it("should handle SelectListInput without options", () => {
    const widget: ToolUIWidget = {
      id   : "test",
      type : "SelectListInput",
      title: "Test",
      mode : "input",
    };

    const result = resolveToolWidgetValueType(widget);
    expect(result).toBe("string | undefined");
  });


});

describe("buildToolHandlerDts", () => {
  it("should generate correct DTS with dynamic SelectListInput types", () => {
    const rows: ToolUIRows = [
      {
        id   : "hash_encoding",
        type : "SelectListInput",
        title: "Hash encoding",
        mode : "input",
        props: {
          options: [
            { value: "bin", label: "Bin" },
            { value: "hex", label: "Hex" },
          ],
        },
      },
    ];

    const dts = buildToolHandlerDts(rows);
    expect(dts).toContain("hash_encoding\": \"bin\" | \"hex\"");
  });

  it("should handle mixed widget types", () => {
    const rows: ToolUIRows = [
      {
        id   : "text_input",
        type : "TextInput",
        title: "Text",
        mode : "input",
      },
      {
        id   : "select_input",
        type : "SelectListInput",
        title: "Select",
        mode : "input",
        props: {
          options: [
            { value: "option1", label: "Option 1" },
            { value: "option2", label: "Option 2" },
          ],
        },
      },
    ];

    const dts = buildToolHandlerDts(rows);
    expect(dts).toContain("text_input\": string");
    expect(dts).toContain("select_input\": \"option1\" | \"option2\"");
  });
});

