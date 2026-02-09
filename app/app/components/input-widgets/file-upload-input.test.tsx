import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { FileUploadInput, FileUploadInputProps, FileUploadInputOutputValueResolver } from "./file-upload-input";
import { ToolInteractionProvider } from "./tool-interaction-context";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render FileUploadInput factory function with interaction context.
function FileUploadInputWrapper({
  id,
  title,
  mode,
  value,
  onChange,
  collectValueRef,
  props,
  isInteractive = true,
}: {
  id             : string;
  title          : string;
  mode           : "input" | "output";
  value          : File | null;
  onChange       : (id: string, newValue: File | null) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<File | null> | undefined>;
  props?         : FileUploadInputProps;
  isInteractive? : boolean;
}) {
  return (
    <ToolInteractionProvider isInteractive={isInteractive}>
      <FileUploadInputRenderer
        id={id}
        title={title}
        mode={mode}
        value={value}
        onChange={onChange}
        collectValueRef={collectValueRef}
        props={props}
      />
    </ToolInteractionProvider>
  );
}

// Render FileUploadInput inside a nested component so context resolves correctly.
function FileUploadInputRenderer({
  id,
  title,
  mode,
  value,
  onChange,
  collectValueRef,
  props,
}: {
  id             : string;
  title          : string;
  mode           : "input" | "output";
  value          : File | null;
  onChange       : (id: string, newValue: File | null) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<File | null> | undefined>;
  props?         : FileUploadInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return (
    <>
      {FileUploadInput(id, title, mode, onChange, collectValueRef, props)}
    </>
  );
}

// Helper to create a deterministic file for test cases.
function createTestFile(name: string, content = "file-content", type = "text/plain") {
  return new File([content], name, { type });
}

describe("FileUploadInput Component", () => {
  const defaultProps = {
    id             : "test-file",
    title          : "Test Upload",
    mode           : "input" as const,
    value          : null,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: FileUploadInputProps = {
        description: "Upload docs",
        mini       : true,
        width      : "240px",
      };

      const result = FileUploadInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = FileUploadInputProps.parse({});
      expect(result).toEqual({});
    });

    it("accepts boolean values for mini", () => {
      const resultTrue = FileUploadInputProps.parse({ mini: true });
      const resultFalse = FileUploadInputProps.parse({ mini: false });
      expect(resultTrue.mini).toBe(true);
      expect(resultFalse.mini).toBe(false);
    });

    it("rejects invalid mini values", () => {
      expect(() => FileUploadInputProps.parse({ mini: "yes" })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates File or null output values", () => {
      const resolver = FileUploadInputOutputValueResolver();
      const file = createTestFile("sample.txt");
      expect(resolver.parse(file)).toBe(file);
      expect(resolver.parse(null)).toBeNull();
    });

    it("rejects non-File values", () => {
      const resolver = FileUploadInputOutputValueResolver();
      expect(() => resolver.parse("invalid")).toThrow();
      expect(() => resolver.parse(123)).toThrow();
      expect(() => resolver.parse({})).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders title as HTML inside label", () => {
      render(<FileUploadInputWrapper {...defaultProps} title="<strong>Bold Title</strong>" />);
      const strong = screen.getByText("Bold Title");
      expect(strong.tagName).toBe("STRONG");
    });

    it("renders helper description when no value is selected", () => {
      render(<FileUploadInputWrapper {...defaultProps} props={{ description: "Upload assets" }} />);
      expect(screen.getByText("Upload assets")).toBeTruthy();
    });

    it("renders mini button text and tooltip when mini is enabled", () => {
      render(<FileUploadInputWrapper {...defaultProps} props={{ mini: true, description: "Add file" }} />);
      const label = screen.getByLabelText("Test Upload");
      expect(label.textContent).toContain("Upload");
      expect(label.getAttribute("title")).toBe("Add file");
    });

    it("renders selected state text for mini variant", () => {
      const file = createTestFile("report.pdf", "pdf-content", "application/pdf");
      render(<FileUploadInputWrapper {...defaultProps} value={file} props={{ mini: true }} />);
      const label = screen.getByLabelText("Test Upload");
      expect(label.textContent).toContain("Selected");
    });

    it("renders a hidden file input", () => {
      const { container } = render(<FileUploadInputWrapper {...defaultProps} />);
      const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.disabled).toBe(false);
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "width",
        props : { width: "180px" },
        verify: () => {
          const label = screen.getByLabelText("Test Upload");
          const container = label.closest(".group") as HTMLElement;
          expect(container.style.width).toBe("180px");
        },
      },
      {
        name  : "mini",
        props : { mini: true },
        verify: () => {
          const label = screen.getByLabelText("Test Upload");
          expect(label.className).toContain("h-8");
        },
      },
      {
        name  : "description",
        props : { description: "Drop files here" },
        verify: () => {
          expect(screen.getByText("Drop files here")).toBeTruthy();
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<FileUploadInputWrapper {...defaultProps} props={props} />);
        verify();
      });
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "null value", value: null },
      { name: "text file", value: createTestFile("notes.txt") },
      { name: "binary file", value: createTestFile("image.png", "data", "image/png") },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
        render(<FileUploadInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      const fileA = createTestFile("a.txt");
      const fileB = createTestFile("b.txt");
      const { rerender } = render(
        <FileUploadInputWrapper {...defaultProps} value={fileA} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toBe(fileA);

      rerender(<FileUploadInputWrapper {...defaultProps} value={null} collectValueRef={collectValueRef} />);
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBeNull();
      });

      rerender(<FileUploadInputWrapper {...defaultProps} value={fileB} collectValueRef={collectValueRef} />);
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(fileB);
      });
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when user selects a file", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      const { container } = render(
        <FileUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />
      );
      const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;
      const file = createTestFile("design.md", "content", "text/markdown");

      await user.upload(input, file);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("test-file", file);
      expect(collectValueRef.current?.getValue()).toBe(file);
      expect(input.files?.[0]).toBe(file);
    });

    it("handles paste event with file data", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      render(<FileUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const label = screen.getByLabelText("Test Upload");
      const file = createTestFile("clipboard.png", "img", "image/png");

      // Simulate clipboard file paste.
      fireEvent.paste(label, {
        clipboardData: {
          files  : [file],
          getData: () => "",
        },
      });

      expect(onChange).toHaveBeenCalledWith("test-file", file);
      expect(collectValueRef.current?.getValue()).toBe(file);
    });

    it("creates a text file when clipboard has plain text", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      render(<FileUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const label = screen.getByLabelText("Test Upload");

      // Simulate clipboard text paste with no files.
      fireEvent.paste(label, {
        clipboardData: {
          files  : [],
          getData: () => "clipboard text",
        },
      });

      const pastedFile = onChange.mock.calls[0][1] as File;
      expect(pastedFile).toBeInstanceOf(File);
      expect(pastedFile.type).toBe("text/plain");
      expect(pastedFile.name).toContain("clipboard");
      expect(collectValueRef.current?.getValue()).toBe(pastedFile);
    });

    it("handles drag and drop file selection", async () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      render(<FileUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const label = screen.getByLabelText("Test Upload");
      const file = createTestFile("drop.txt");

      // Simulate drag enter to activate dragging styles.
      fireEvent.dragEnter(label, { dataTransfer: { files: [file] } });
      await waitFor(() => {
        expect(label.className).toContain("bg-muted/60");
      });

      fireEvent.drop(label, { dataTransfer: { files: [file] } });

      expect(onChange).toHaveBeenCalledWith("test-file", file);
      expect(collectValueRef.current?.getValue()).toBe(file);
    });
  });

  describe("Output Mode Behavior", () => {
    it("prevents user actions while keeping collectValueRef in sync", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      const file = createTestFile("readonly.txt");
      const { container } = render(
        <FileUploadInputWrapper
          {...defaultProps}
          mode="output"
          value={file}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );
      const label = screen.getByLabelText("Test Upload");
      const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;

      expect(label.getAttribute("aria-readonly")).toBe("true");
      expect(label.getAttribute("tabindex")).toBe("-1");
      expect(input.disabled).toBe(true);
      expect(collectValueRef.current?.getValue()).toBe(file);

      fireEvent.change(input, { target: { files: [createTestFile("should-not-change.txt")] } });
      fireEvent.paste(label, { clipboardData: { files: [], getData: () => "text" } });

      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toBe(file);
    });

    it("treats interaction-disabled mode as read-only", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File | null> | undefined>() as RefObject<WidgetValueCollectorInf<File | null> | undefined>;
      const file = createTestFile("disabled.txt");

      render(
        <FileUploadInputWrapper
          {...defaultProps}
          value={file}
          onChange={onChange}
          collectValueRef={collectValueRef}
          isInteractive={false}
        />
      );

      const label = screen.getByLabelText("Test Upload");
      expect(label.getAttribute("aria-readonly")).toBe("true");
      expect(collectValueRef.current?.getValue()).toBe(file);
    });
  });
});
