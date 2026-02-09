import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject, type ReactNode } from "react";
import { ToolInteractionProvider } from "./tool-interaction-context";
import { WaveformPlaylistInput, WaveformPlaylistInputOutputValueResolver, WaveformPlaylistInputProps, type WaveformPlaylistInputOutputValue } from "./waveform-playlist-input";
import type { WidgetValueCollectorInf } from "./input-types";

vi.mock("@waveform-playlist/browser", () => {
  function MockWaveformPlaylistProvider({ children }: { children: ReactNode }) {
    return <div data-testid="waveform-provider">{children}</div>;
  }
  function MockWaveform() {
    return <div data-testid="waveform" />;
  }
  function useAudioTracks(configs: unknown[]) {
    const hasTracks = configs.length > 0;
    return { tracks: hasTracks ? [{ id: "track-1" }] : [], loading: false, error: null, loadedCount: configs.length, totalCount: configs.length };
  }
  function MockButton({ children, ...rest }: { children: ReactNode }) {
    return <button type="button" {...rest}>{children}</button>;
  }
  function MockAudioPosition() {
    return <div data-testid="audio-position" />;
  }
  return {
    WaveformPlaylistProvider: MockWaveformPlaylistProvider,
    Waveform                : MockWaveform,
    PlayButton              : (props: any) => <MockButton {...props}>Play</MockButton>,
    PauseButton             : (props: any) => <MockButton {...props}>Pause</MockButton>,
    StopButton              : (props: any) => <MockButton {...props}>Stop</MockButton>,
    ZoomInButton            : (props: any) => <MockButton {...props}>ZoomIn</MockButton>,
    ZoomOutButton           : (props: any) => <MockButton {...props}>ZoomOut</MockButton>,
    AudioPosition           : MockAudioPosition,
    useAudioTracks,
  };
});

// Wrapper component to render WaveformPlaylistInput with interaction context.
function WaveformPlaylistInputWrapper({
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
  value          : WaveformPlaylistInputOutputValue;
  onChange       : (id: string, newValue: WaveformPlaylistInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<WaveformPlaylistInputOutputValue> | undefined>;
  props?         : WaveformPlaylistInputProps;
  isInteractive? : boolean;
}) {
  return (
    <ToolInteractionProvider isInteractive={isInteractive}>
      <WaveformPlaylistInputRenderer
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

// Render WaveformPlaylistInput inside a nested component so context resolves correctly.
function WaveformPlaylistInputRenderer({
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
  value          : WaveformPlaylistInputOutputValue;
  onChange       : (id: string, newValue: WaveformPlaylistInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<WaveformPlaylistInputOutputValue> | undefined>;
  props?         : WaveformPlaylistInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{WaveformPlaylistInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Helper to create a deterministic file for test cases.
function createTestFile(name: string, content = "audio-content", type = "audio/wav") {
  return new File([content], name, { type });
}

// Helper to build a consistent output payload for assertions.
function buildOutputValue(file: File | null, url: string | null): WaveformPlaylistInputOutputValue {
  if (!file) return { file: null, url: null, name: null, type: null, size: null, lastModified: null };
  return {
    file,
    url,
    name        : file.name,
    type        : file.type || null,
    size        : file.size,
    lastModified: file.lastModified,
    clips       : [],
  };
}

// Helper to create a ref with the collector type that matches component expectations.
function createCollectorRef(): RefObject<WidgetValueCollectorInf<WaveformPlaylistInputOutputValue> | undefined> {
  return createRef<WidgetValueCollectorInf<WaveformPlaylistInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<WaveformPlaylistInputOutputValue> | undefined>;
}

describe("WaveformPlaylistInput Component", () => {
  const defaultValue = buildOutputValue(null, null);
  const defaultProps = {
    id             : "test-waveform",
    title          : "Audio Input",
    mode           : "input" as const,
    value          : defaultValue,
    onChange       : vi.fn(),
    collectValueRef: createCollectorRef(),
  };

  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-audio");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: WaveformPlaylistInputProps = {
        description    : "Upload audio",
        accept         : "audio/*",
        waveHeight     : 160,
        samplesPerPixel: 1024,
        showControls   : false,
        width          : "320px",
      };

      const result = WaveformPlaylistInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = WaveformPlaylistInputProps.parse({});
      expect(result).toEqual({});
    });

    it("rejects invalid waveHeight values", () => {
      expect(() => WaveformPlaylistInputProps.parse({ waveHeight: "large" })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates waveform output payloads", () => {
      const resolver = WaveformPlaylistInputOutputValueResolver();
      const file = createTestFile("track.wav");
      const value = buildOutputValue(file, "blob:track");
      expect(resolver.parse(value)).toEqual(value);
      expect(resolver.parse(defaultValue)).toEqual(defaultValue);
    });

    it("rejects invalid output payloads", () => {
      const resolver = WaveformPlaylistInputOutputValueResolver();
      expect(() => resolver.parse({})).toThrow();
      expect(() => resolver.parse({ file: null })).toThrow();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const cases = [
      { name: "empty value", value: buildOutputValue(null, null) },
      { name: "file with url", value: buildOutputValue(createTestFile("a.wav"), "blob:audio") },
    ];

    cases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createCollectorRef();
        render(<WaveformPlaylistInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toEqual(value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createCollectorRef();
      const values = [
        buildOutputValue(null, null),
        buildOutputValue(createTestFile("b.wav"), "blob:b"),
        buildOutputValue(createTestFile("c.wav"), "blob:c"),
      ];

      const { rerender } = render(
        <WaveformPlaylistInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />
      );

      for (let i = 1; i < values.length; i++) {
        rerender(<WaveformPlaylistInputWrapper {...defaultProps} value={values[i]} collectValueRef={collectValueRef} />);
        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toEqual(values[i]);
        });
      }
    });
  });

  describe("User Interaction", () => {
    it("onChange and collectValueRef stay in sync after upload", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createCollectorRef();
      const file = createTestFile("mix.wav");

      render(<WaveformPlaylistInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const input = screen.getByLabelText("Audio Input");
      await user.upload(input, file);

      expect(onChange).toHaveBeenCalledTimes(1);
      const [id, nextValue] = onChange.mock.calls[0];
      expect(id).toBe("test-waveform");
      expect(nextValue.file).toBe(file);
      expect(nextValue.url).toBe("blob:mock-audio");
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toEqual(nextValue);
      });
    });
  });

  describe("Output Mode", () => {
    it("disables upload interactions in output mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const file = createTestFile("readonly.wav");

      render(<WaveformPlaylistInputWrapper {...defaultProps} mode="output" onChange={onChange} />);
      const input = screen.getByLabelText("Audio Input");
      expect(input).toHaveProperty("disabled", true);
      await user.upload(input, file);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Props Application Verification", () => {
    it("applies width prop to container", () => {
      render(<WaveformPlaylistInputWrapper {...defaultProps} props={{ width: "420px" }} />);
      const input = screen.getByLabelText("Audio Input");
      const container = input.closest(".group") as HTMLElement;
      expect(container.style.width).toBe("420px");
    });

    it("renders description text when provided", () => {
      render(<WaveformPlaylistInputWrapper {...defaultProps} props={{ description: "Upload audio files" }} />);
      expect(screen.getByText("Upload audio files")).toBeTruthy();
    });

    it("hides controls when showControls is false", () => {
      const valueWithAudio = buildOutputValue(createTestFile("controls.wav"), "blob:controls");
      render(<WaveformPlaylistInputWrapper {...defaultProps} value={valueWithAudio} props={{ showControls: false }} />);
      expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    });
  });
});
