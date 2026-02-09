import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { FilesUploadInput, FilesUploadInputProps, FilesUploadInputOutputValueResolver } from "./files-upload-input";
import { ToolInteractionProvider } from "./tool-interaction-context";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render FilesUploadInput factory function with interaction context.
function FilesUploadInputWrapper({
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
  value          : File[] | null;
  onChange       : (id: string, newValue: File[] | null) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
  props?         : FilesUploadInputProps;
  isInteractive? : boolean;
}) {
  return (
    <ToolInteractionProvider isInteractive={isInteractive}>
      <FilesUploadInputRenderer
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

// Render FilesUploadInput inside a nested component so context resolves correctly.
function FilesUploadInputRenderer({
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
  value          : File[] | null;
  onChange       : (id: string, newValue: File[] | null) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
  props?         : FilesUploadInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return (
    <>
      {FilesUploadInput(id, title, mode, onChange, collectValueRef, props)}
    </>
  );
}

// Helper to create a deterministic file for test cases.
function createTestFile(name: string, content = "file-content", type = "text/plain") {
  return new File([content], name, { type });
}

// Helper to attach webkitRelativePath for directory selection tests.
function createFileWithRelativePath(name: string, relativePath: string) {
  const file = createTestFile(name);
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

// Helper to build mock clipboard items with files.
function buildClipboardItems(files: File[]) {
  return files.map((file) => ({ kind: "file", getAsFile: () => file } as DataTransferItem));
}

describe("FilesUploadInput Component", () => {
  const defaultProps = {
    id             : "test-files",
    title          : "Test Upload",
    mode           : "input" as const,
    value          : null,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: FilesUploadInputProps = {
        description   : "Upload docs",
        allowDirectory: true,
        mini          : true,
        width         : "240px",
      };

      const result = FilesUploadInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = FilesUploadInputProps.parse({});
      expect(result).toEqual({});
    });

    it("accepts boolean values for allowDirectory and mini", () => {
      const result = FilesUploadInputProps.parse({ allowDirectory: false, mini: true });
      expect(result.allowDirectory).toBe(false);
      expect(result.mini).toBe(true);
    });

    it("rejects invalid allowDirectory values", () => {
      expect(() => FilesUploadInputProps.parse({ allowDirectory: "yes" })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates File array or null output values", () => {
      const resolver = FilesUploadInputOutputValueResolver();
      const files = [createTestFile("a.txt"), createTestFile("b.txt")];
      expect(resolver.parse(files)).toStrictEqual(files);
      expect(resolver.parse(null)).toBeNull();
    });

    it("rejects non-File values", () => {
      const resolver = FilesUploadInputOutputValueResolver();
      expect(() => resolver.parse("invalid")).toThrow();
      expect(() => resolver.parse([123])).toThrow();
      expect(() => resolver.parse({})).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders title as HTML inside label", () => {
      render(<FilesUploadInputWrapper {...defaultProps} title="<strong>Bold Title</strong>" />);
      const strong = screen.getByText("Bold Title");
      expect(strong.tagName).toBe("STRONG");
    });

    it("renders helper description when no value is selected", () => {
      render(<FilesUploadInputWrapper {...defaultProps} props={{ description: "Upload assets" }} />);
      expect(screen.getByText("Upload assets")).toBeTruthy();
    });

    it("renders mini button text and tooltip when mini is enabled", () => {
      render(<FilesUploadInputWrapper {...defaultProps} props={{ mini: true, description: "Add file" }} />);
      const label = screen.getByLabelText("Test Upload");
      expect(label.textContent).toContain("Upload");
      expect(label.getAttribute("title")).toBe("Add file");
    });

    it("renders selected state text for mini variant", () => {
      const files = [createTestFile("report.pdf", "pdf-content", "application/pdf")];
      render(<FilesUploadInputWrapper {...defaultProps} value={files} props={{ mini: true }} />);
      const label = screen.getByLabelText("Test Upload");
      expect(label.textContent).toContain("Selected");
    });

    it("renders file summary text when multiple files are selected", () => {
      const files = [createTestFile("a.txt"), createTestFile("b.txt"), createTestFile("c.txt")];
      render(<FilesUploadInputWrapper {...defaultProps} value={files} />);
      expect(screen.getByText("a.txt, b.txt +1 more")).toBeTruthy();
    });

    it("renders a hidden file input", () => {
      const { container } = render(<FilesUploadInputWrapper {...defaultProps} />);
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
      {
        name  : "allowDirectory",
        props : { allowDirectory: true },
        verify: () => {
          const input = screen.getByLabelText("Test Upload").parentElement?.querySelector("input[type=\"file\"]") as HTMLInputElement;
          expect(input.getAttribute("webkitdirectory")).toBe("true");
          expect(input.getAttribute("directory")).toBe("true");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<FilesUploadInputWrapper {...defaultProps} props={props} />);
        verify();
      });
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "null value", value: null },
      { name: "single file", value: [createTestFile("notes.txt")] },
      { name: "multiple files", value: [createTestFile("a.png"), createTestFile("b.png")] },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
        render(<FilesUploadInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      const filesA = [createTestFile("a.txt")];
      const filesB = [createTestFile("b.txt"), createTestFile("c.txt")];
      const { rerender } = render(
        <FilesUploadInputWrapper {...defaultProps} value={filesA} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toBe(filesA);

      rerender(<FilesUploadInputWrapper {...defaultProps} value={null} collectValueRef={collectValueRef} />);
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBeNull();
      });

      rerender(<FilesUploadInputWrapper {...defaultProps} value={filesB} collectValueRef={collectValueRef} />);
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(filesB);
      });
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when user selects files", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      const { container } = render(
        <FilesUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />
      );
      const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;
      const files = [createTestFile("design.md", "content", "text/markdown"), createTestFile("notes.txt")];

      await user.upload(input, files);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("test-files", files);
      expect(collectValueRef.current?.getValue()).toStrictEqual(files);
      expect(input.files?.length).toBe(2);
    });

    it("applies relative path when allowDirectory is enabled", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      const { container } = render(
        <FilesUploadInputWrapper
          {...defaultProps}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ allowDirectory: true }}
        />
      );
      const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;
      const fileWithPath = createFileWithRelativePath("readme.md", "docs/readme.md");

      await user.upload(input, [fileWithPath]);

      const uploadedFiles = onChange.mock.calls[0][1] as File[];
      const firstFile = uploadedFiles[0] as File & { relativePath?: string };
      expect(firstFile.relativePath).toBe("docs/readme.md");
      expect(collectValueRef.current?.getValue()).toStrictEqual(uploadedFiles);
    });

    it("handles paste event with clipboard items", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      render(<FilesUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const label = screen.getByLabelText("Test Upload");
      const files = [createTestFile("clipboard.png", "img", "image/png")];

      // Simulate clipboard file paste using items.
      fireEvent.paste(label, {
        clipboardData: {
          items  : buildClipboardItems(files),
          files  : [],
          getData: () => "",
        },
      });

      expect(onChange).toHaveBeenCalledWith("test-files", files);
      expect(collectValueRef.current?.getValue()).toStrictEqual(files);
    });

    it("creates a text file when clipboard has plain text", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      render(<FilesUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const label = screen.getByLabelText("Test Upload");

      // Simulate clipboard text paste with no files.
      fireEvent.paste(label, {
        clipboardData: {
          items  : [],
          files  : [],
          getData: () => "clipboard text",
        },
      });

      const pastedFiles = onChange.mock.calls[0][1] as File[];
      const pastedFile = pastedFiles[0];
      expect(pastedFile).toBeInstanceOf(File);
      expect(pastedFile.type).toBe("text/plain");
      expect(pastedFile.name).toContain("clipboard");
      expect(collectValueRef.current?.getValue()).toStrictEqual(pastedFiles);
    });

    it("handles drag and drop file selection", async () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      render(<FilesUploadInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const label = screen.getByLabelText("Test Upload");
      const files = [createTestFile("drop.txt")];

      fireEvent.dragEnter(label, { dataTransfer: { files } });
      await waitFor(() => {
        expect(label.className).toContain("bg-muted/60");
      });

      fireEvent.drop(label, { dataTransfer: { files } });

      expect(onChange).toHaveBeenCalledWith("test-files", files);
      expect(collectValueRef.current?.getValue()).toStrictEqual(files);
    });
  });

  describe("Output Mode Behavior", () => {
    it("prevents user actions while keeping collectValueRef in sync", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      const files = [createTestFile("readonly.txt")];
      const { container } = render(
        <FilesUploadInputWrapper
          {...defaultProps}
          mode="output"
          value={files}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );
      const label = screen.getByLabelText("Test Upload");
      const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;

      expect(label.getAttribute("aria-readonly")).toBe("true");
      expect(label.getAttribute("tabindex")).toBe("-1");
      expect(input.disabled).toBe(true);
      expect(collectValueRef.current?.getValue()).toBe(files);

      fireEvent.change(input, { target: { files: [createTestFile("should-not-change.txt")] } });
      fireEvent.paste(label, { clipboardData: { items: [], files: [], getData: () => "text" } });

      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toBe(files);
    });

    it("treats interaction-disabled mode as read-only", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<File[] | null> | undefined>() as RefObject<WidgetValueCollectorInf<File[] | null> | undefined>;
      const files = [createTestFile("disabled.txt")];

      render(
        <FilesUploadInputWrapper
          {...defaultProps}
          value={files}
          onChange={onChange}
          collectValueRef={collectValueRef}
          isInteractive={false}
        />
      );

      const label = screen.getByLabelText("Test Upload");
      expect(label.getAttribute("aria-readonly")).toBe("true");
      expect(collectValueRef.current?.getValue()).toBe(files);
    });
  });
});
