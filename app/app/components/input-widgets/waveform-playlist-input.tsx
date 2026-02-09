import { useEffect, useRef, useState, useImperativeHandle, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { z } from "zod";
import { Pause, Play, Scissors, Square, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { DndContext, type DragStartEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { createClipFromSeconds, createTrack, type ClipTrack } from "@waveform-playlist/core";
import { getGlobalAudioContext } from "@waveform-playlist/playout";
import { AudioPosition, Waveform, WaveformPlaylistProvider, useClipDragHandlers, useClipSplitting, useDragSensors, useExportWav, usePlaybackAnimation, usePlaylistControls, usePlaylistData } from "@waveform-playlist/browser";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";
import { useToolInteractionEnabled } from "./tool-interaction-context";
import type { WidgetValueCollectorInf } from "./input-types";

export const WaveformPlaylistInputProps = z.object({
  description    : z.string().optional(),
  accept         : z.string().optional(),
  waveHeight     : z.number().optional(),
  samplesPerPixel: z.number().optional(),
  showControls   : z.boolean().optional(),
  width          : z.string().optional(),
});
export type WaveformPlaylistInputProps = z.infer<typeof WaveformPlaylistInputProps>;

export const WaveformPlaylistInputOutputValue = z.object({
  file        : z.instanceof(File).nullable(),
  url         : z.string().nullable(),
  name        : z.string().nullable(),
  type        : z.string().nullable(),
  size        : z.number().nullable(),
  lastModified: z.number().nullable(),
  clips       : z.array(z.object({
    startTime: z.number(),
    duration : z.number(),
    offset   : z.number(),
    name     : z.string().nullable(),
  })).optional(),
});
export type WaveformPlaylistInputOutputValue = z.infer<typeof WaveformPlaylistInputOutputValue>;

export function WaveformPlaylistInputOutputValueResolver(): z.ZodTypeAny {
  return WaveformPlaylistInputOutputValue;
}

export const WaveformPlaylistInputUsageExample: WidgetGuideItem = {
  name       : "Waveform Playlist",
  description: "Upload an audio file to preview its waveform, play it back, and download the current track.",
  widget     : {
    id   : "guide-waveform-playlist",
    type : "WaveformPlaylistInput",
    title: "Audio Track",
    mode : "input",
    props: {
      description    : "Drop an audio file to visualize and preview the waveform",
      accept         : "audio/*",
      waveHeight     : 120,
      samplesPerPixel: 512,
      showControls   : true,
    },
  },
};

function buildEmptyWaveformValue(): WaveformPlaylistInputOutputValue {
  return { file: null, url: null, name: null, type: null, size: null, lastModified: null };
}

function normalizeWaveformValue(value: WaveformPlaylistInputOutputValue | null | undefined): WaveformPlaylistInputOutputValue {
  return value ?? buildEmptyWaveformValue();
}

function buildWaveformValueFromFile(file: File, url: string): WaveformPlaylistInputOutputValue {
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

function formatBytes(bytes: number | null) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = -1;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTimestamp(timestamp: number | null) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "unknown";
  return new Date(timestamp).toLocaleString();
}

function buildTrackFromAudioBuffer(audioBuffer: AudioBuffer, name: string) {
  const clip = createClipFromSeconds({
    audioBuffer,
    startTime: 0,
    duration : audioBuffer.duration,
    offset   : 0,
    name     : "New clip",
  });
  return createTrack({ name, clips: [clip], muted: false, soloed: false, volume: 1, pan: 0 });
}

function formatTimestampSeconds(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Distinct clip palette to make split segments easier to recognize.
const CLIP_COLORS = ["#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#22C55E", "#F97316", "#14B8A6"];

// Ensure every clip has a visible color.
function assignClipColors(tracks: ClipTrack[]) {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip, index) => ({
      ...clip,
      color: CLIP_COLORS[index % CLIP_COLORS.length],
    })),
  }));
}

function createClipId() {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Keep clip ids stable and names controlled by the UI (default: New clip).
function normalizeClipMetadata(tracks: ClipTrack[], nameMap: Map<string, string>) {
  const activeIds = new Set<string>();
  const normalized = tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      let clipId = clip.id;
      let clipName = nameMap.get(clipId);
      if (!clipName) {
        clipId = createClipId();
        clipName = "New clip";
        nameMap.set(clipId, clipName);
      }
      activeIds.add(clipId);
      return { ...clip, id: clipId, name: clipName };
    }),
  }));

  for (const id of nameMap.keys()) {
    if (!activeIds.has(id)) nameMap.delete(id);
  }

  return normalized;
}

// Build a human-readable label for the clip list.
function getClipDisplayName(name: string | undefined) {
  return name ?? "New clip";
}

function buildClipLabel(clip: ClipTrack["clips"][number]) {
  return getClipDisplayName(clip.name);
}

function applyClipColorStyles(container: HTMLDivElement | null, tracks: ClipTrack[]) {
  if (!container) return;
  const colorMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  let didChange = false;
  let headerCount = 0;
  tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      if (clip.color) colorMap.set(clip.id, clip.color);
      if (clip.name) nameMap.set(clip.id, clip.name);
    });
  });
  const headers = Array.from(container.querySelectorAll<HTMLElement>("[data-clip-id]:not([data-boundary-edge])"));
  headerCount = headers.length;
  headers.forEach((header) => {
    const clipId = header.dataset.clipId;
    const color = clipId ? colorMap.get(clipId) : undefined;
    const name = clipId ? nameMap.get(clipId) : undefined;
    if (!color) {
      if (header.style.backgroundColor) {
        header.style.backgroundColor = "";
        didChange = true;
      }
      if (header.style.borderColor) {
        header.style.borderColor = "";
        didChange = true;
      }
      if (header.style.color) {
        header.style.color = "";
        didChange = true;
      }
      const clipContainer = header.closest<HTMLElement>("[data-clip-container]");
      if (clipContainer && clipContainer.style.boxShadow) {
        clipContainer.style.boxShadow = "";
        didChange = true;
      }
      return;
    }
    if (header.style.backgroundColor !== color) {
      header.style.backgroundColor = color;
      didChange = true;
    }
    if (header.style.borderColor !== color) {
      header.style.borderColor = color;
      didChange = true;
    }
    if (header.style.color !== "rgb(255, 255, 255)" && header.style.color !== "#fff") {
      header.style.color = "#fff";
      didChange = true;
    }
    const nextLabel = getClipDisplayName(name);
    if (header.textContent !== nextLabel) {
      header.textContent = nextLabel;
      didChange = true;
    }
    const clipContainer = header.closest<HTMLElement>("[data-clip-container]");
    if (clipContainer && clipContainer.style.boxShadow !== `inset 0 0 0 1px ${color}`) {
      clipContainer.style.boxShadow = `inset 0 0 0 1px ${color}`;
      didChange = true;
    }
  });
  if (didChange) {
    console.log("[WaveformPlaylistInput] applyClipColorStyles updated", { headerCount, clipCount: colorMap.size });
  }
  return didChange;
}

// Build a single-track export from the selected clip segment.
function buildExportTrackFromClip(clip: ClipTrack["clips"][number]) {
  const clipDuration = clip.durationSamples / clip.sampleRate;
  const clipOffset = clip.offsetSamples / clip.sampleRate;
  const clipName = clip.name ?? "New clip";
  return createTrack({
    name : clipName,
    clips: [
      createClipFromSeconds({
        audioBuffer: clip.audioBuffer,
        startTime  : 0,
        duration   : clipDuration,
        offset     : clipOffset,
        name       : clipName,
        color      : clip.color,
      }),
    ],
    muted : false,
    soloed: false,
    volume: 1,
    pan   : 0,
  });
}

// Sanitize filenames for browser downloads.
function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_");
}

function stripFileExtension(name: string | null) {
  if (!name) return "audio";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return name;
  return name.slice(0, dotIndex);
}

function calculateFitSamplesPerPixel(tracks: ClipTrack[], width: number) {
  if (tracks.length === 0 || width <= 0) return null;
  let maxEndSec = 0;
  let sampleRate = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const endSec = (clip.startSample + clip.durationSamples) / clip.sampleRate;
      if (endSec > maxEndSec) maxEndSec = endSec;
      if (!sampleRate) sampleRate = clip.sampleRate;
    }
  }
  if (!sampleRate || maxEndSec <= 0) return null;
  const fitValue = Math.max(1, Math.ceil((maxEndSec * sampleRate) / width));
  console.log("[WaveformPlaylistInput] fitSamplesPerPixel", { width, maxEndSec, sampleRate, fitValue });
  return fitValue;
}

function buildZoomLevels(fitSamplesPerPixel: number | null) {
  const baseLevels = [256, 512, 1024, 2048, 4096, 8192];
  if (!fitSamplesPerPixel) return baseLevels;
  // Build gentle zoom steps around the fit value to avoid large jumps.
  const levels = new Set<number>(baseLevels);
  const minLevel = 1;
  const maxLevel = 8192;
  const downFactor = 0.8;
  const upFactor = 1.25;
  levels.add(fitSamplesPerPixel);
  let value = fitSamplesPerPixel;
  while (value > minLevel) {
    value = Math.floor(value * downFactor);
    if (value < minLevel) value = minLevel;
    levels.add(value);
    if (value === minLevel) break;
  }
  value = fitSamplesPerPixel;
  while (value < maxLevel) {
    value = Math.ceil(value * upFactor);
    if (value > maxLevel) value = maxLevel;
    levels.add(value);
    if (value === maxLevel) break;
  }
  return Array.from(levels).sort((a, b) => a - b);
}

function buildClipOutput(tracks: ClipTrack[]) {
  return tracks.flatMap((track) =>
    track.clips.map((clip) => ({
      startTime: clip.startSample / clip.sampleRate,
      duration : clip.durationSamples / clip.sampleRate,
      offset   : clip.offsetSamples / clip.sampleRate,
      name     : clip.name ?? null,
    }))
  );
}

// Avoid redundant value updates when clip metadata is unchanged.
function areClipOutputsEqual(a: WaveformPlaylistInputOutputValue["clips"], b: WaveformPlaylistInputOutputValue["clips"]) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((clip, index) => {
    const other = b[index];
    if (!other) return false;
    return clip.startTime === other.startTime
      && clip.duration === other.duration
      && clip.offset === other.offset
      && clip.name === other.name;
  });
}

// Icon-only controls bound to the waveform playlist context.
function WaveformControlsRow({
  disabled,
  tracks,
  onTracksChange,
}: {
  disabled      : boolean;
  tracks        : ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
}) {
  const controls = usePlaylistControls();
  const playlistData = usePlaylistData();
  const isReady = playlistData.isReady;
  const { splitClipAtPlayhead } = useClipSplitting({
    tracks,
    onTracksChange,
    sampleRate     : playlistData.sampleRate,
    samplesPerPixel: playlistData.samplesPerPixel,
  });
  const [timecodeInput, setTimecodeInput] = useState("");

  function handleSplit() {
    splitClipAtPlayhead();
  }

  function parseTimecode(value: string) {
    const parts = value.trim().split(":");
    if (parts.length !== 3) return null;
    const [hoursRaw, minutesRaw, secondsRaw] = parts;
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if (![hours, minutes, seconds].every((part) => Number.isFinite(part))) return null;
    if (minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59 || hours < 0) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function handleSeekSubmit() {
    const targetSeconds = parseTimecode(timecodeInput);
    if (targetSeconds === null) return;
    controls.seekTo(targetSeconds);
  }

  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <ControlButton label="Play" disabled={disabled || !isReady} onClick={() => void controls.play()}>
          <Play className="h-3.5 w-3.5" />
        </ControlButton>
        <ControlButton label="Pause" disabled={disabled || !isReady} onClick={controls.pause}>
          <Pause className="h-3.5 w-3.5" />
        </ControlButton>
        <ControlButton label="Stop" disabled={disabled || !isReady} onClick={controls.stop}>
          <Square className="h-3.5 w-3.5" />
        </ControlButton>
        <ControlButton label="Zoom out" disabled={disabled || !playlistData.canZoomOut} onClick={controls.zoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </ControlButton>
        <ControlButton label="Zoom in" disabled={disabled || !playlistData.canZoomIn} onClick={controls.zoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </ControlButton>
        <ControlButton label="Split clip" disabled={disabled || !isReady} onClick={handleSplit}>
          <Scissors className="h-3.5 w-3.5" />
        </ControlButton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AudioPosition className="text-[11px]" />
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="waveform-timecode-input">Seek time</label>
          <input
            id="waveform-timecode-input"
            type="text"
            inputMode="numeric"
            placeholder="00:00:00"
            className="h-7 w-[92px] rounded-md border border-border bg-transparent px-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            value={timecodeInput}
            onChange={(event) => setTimecodeInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (disabled || !isReady) return;
              handleSeekSubmit();
            }}
            disabled={disabled || !isReady}
          />
          <button
            type="button"
            className={cn(
              "h-7 rounded-md border border-border px-2 text-[11px] font-medium transition",
              disabled || !isReady ? "cursor-not-allowed opacity-60" : "hover:border-primary/60 hover:text-primary"
            )}
            onClick={handleSeekSubmit}
            disabled={disabled || !isReady}
          >
            Seek
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label   : string;
  disabled: boolean;
  onClick : () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md border border-border transition",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/60 hover:text-primary"
      )}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  );
}

function KeyboardShortcuts({ enabled }: { enabled: boolean }) {
  const { play, pause, stop, seekTo } = usePlaylistControls();
  const { isPlaying } = usePlaybackAnimation();

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)) return;
      switch (event.code) {
        case "Space":
          event.preventDefault();
          if (isPlaying) pause();
          else void play();
          break;
        case "Home":
          event.preventDefault();
          seekTo(0);
          break;
        case "Escape":
          event.preventDefault();
          stop();
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, isPlaying, pause, play, seekTo, stop]);

  return null;
}

function WaveformClipCanvas({
  tracks,
  onTracksChange,
  isReadOnly,
  onSelectClip,
  containerRef,
}: {
  tracks        : ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  isReadOnly    : boolean;
  onSelectClip  : (clipId: string) => void;
  containerRef  : RefObject<HTMLDivElement | null>;
}) {
  const playlistData = usePlaylistData();
  const sensors = useDragSensors();
  const { onDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel: playlistData.samplesPerPixel,
    sampleRate     : playlistData.sampleRate,
  });

  // Ensure drag events carry the required active payload while selecting the clip on drag start.
  function handleDragStart(event: DragStartEvent) {
    const clipId = event.active?.data?.current?.clipId as string | undefined;
    if (clipId) onSelectClip(clipId);
    onDragStart(event);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[restrictToHorizontalAxis, collisionModifier]}
    >
      <div ref={containerRef} className={cn("rounded-md border border-border/50 bg-background/60", isReadOnly && "pointer-events-none")}>
        <Waveform className="w-full" showClipHeaders interactiveClips />
      </div>
    </DndContext>
  );
}

function ClipList({
  tracks,
  selectedClipId,
  onSelectClip,
  onRenameClip,
  onCancelClip,
  onDeleteClip,
  baseFileName,
}: {
  tracks        : ClipTrack[];
  selectedClipId: string | null;
  onSelectClip  : (clipId: string) => void;
  onRenameClip  : (clipId: string, name: string) => void;
  onCancelClip  : () => void;
  onDeleteClip  : () => void;
  baseFileName  : string;
}) {
  if (tracks.length === 0) return null;
  const { exportWav, isExporting } = useExportWav();
  const playlistData = usePlaylistData();

  // Export a single clip segment as WAV.
  async function handleDownloadClip(clipId: string) {
    const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
    if (!selectedClip?.audioBuffer) return;
    const exportTrack = buildExportTrackFromClip(selectedClip);
    const filename = sanitizeFilename(baseFileName);
    await exportWav([exportTrack], [{ muted: false, soloed: false, volume: 1, pan: 0 }], {
      filename,
      mode      : "individual",
      trackIndex: 0,
    });
  }

  // Export every clip as its own file.
  async function handleDownloadAllClips() {
    for (const clip of tracks.flatMap((track) => track.clips)) {
      if (!clip.audioBuffer) continue;
      const exportTrack = buildExportTrackFromClip(clip);
      const filename = sanitizeFilename(baseFileName);
      await exportWav([exportTrack], [{ muted: false, soloed: false, volume: 1, pan: 0 }], {
        filename,
        mode      : "individual",
        trackIndex: 0,
      });
    }
  }

  // Export the full edited timeline.
  async function handleDownloadFullAudio() {
    const trackStates = playlistData.trackStates.length > 0
      ? playlistData.trackStates
      : tracks.map(() => ({ muted: false, soloed: false, volume: 1, pan: 0 }));
    const filename = sanitizeFilename(`${baseFileName}_edited`);
    console.log("[WaveformPlaylistInput] download full audio", { baseFileName, filename });
    await exportWav(tracks, trackStates, { filename, mode: "master" });
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clips</div>
      <div className="flex flex-col gap-2">
        {tracks.map((track) => (
          track.clips.map((clip) => (
            <div
              key={clip.id}
              className={cn(
                "rounded-md border px-2 py-1 text-left text-[11px] transition",
                selectedClipId === clip.id ? "border-primary text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
              )}
            >
              <button type="button" className="flex w-full items-center justify-between gap-2" onClick={() => onSelectClip(clip.id)}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: clip.color ?? "#94A3B8" }} />
                  <span>{buildClipLabel(clip)}</span>
                </span>
                <span className="text-[10px] text-muted-foreground">{formatTimestampSeconds(clip.durationSamples / clip.sampleRate)}</span>
              </button>
              {selectedClipId === clip.id && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground"
                    value={clip.name ?? ""}
                    placeholder="Clip name"
                    onChange={(event) => onRenameClip(clip.id, event.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-[11px] font-medium transition hover:border-primary/60 hover:text-primary"
                      onClick={() => void handleDownloadClip(clip.id)}
                      disabled={isExporting}
                    >
                      {isExporting ? "Downloading..." : "Download Clip"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-[11px] font-medium transition hover:border-primary/60 hover:text-primary"
                      onClick={onCancelClip}
                    >
                      Cancel Clip
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-[11px] font-medium text-destructive transition hover:border-destructive/60 hover:text-destructive"
                      onClick={onDeleteClip}
                    >
                      Delete Clip
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-[11px] font-medium transition hover:border-primary/60 hover:text-primary"
          onClick={() => void handleDownloadAllClips()}
          disabled={isExporting}
        >
          {isExporting ? "Downloading..." : "Download All Clips"}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-[11px] font-medium transition hover:border-primary/60 hover:text-primary"
          onClick={() => void handleDownloadFullAudio()}
          disabled={isExporting}
        >
          {isExporting ? "Downloading..." : "Download Full Audio"}
        </button>
      </div>
    </div>
  );
}

export function WaveformPlaylistInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: WaveformPlaylistInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<WaveformPlaylistInputOutputValue> | undefined>,
  props?: WaveformPlaylistInputProps
) {
  // Parse props with defaults so visual options stay predictable.
  const {
    description = "Upload an audio file to preview its waveform",
    accept = "audio/*",
    waveHeight = 120,
    samplesPerPixel = 512,
    showControls = true,
    width,
  } = WaveformPlaylistInputProps.parse(props ?? {});

  const initialValue = normalizeWaveformValue(null);
  const [widgetValue, setWidgetValue] = useState<WaveformPlaylistInputOutputValue>(initialValue);
  const widgetValueRef = useRef<WaveformPlaylistInputOutputValue>(initialValue);
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const clipNameByIdRef = useRef(new Map<string, string>());
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [fitSamplesPerPixel, setFitSamplesPerPixel] = useState<number | null>(null);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const zoomLevels = buildZoomLevels(fitSamplesPerPixel);
  const isOutputMode = mode === "output";
  const isInteractive = useToolInteractionEnabled();
  const isReadOnly = isOutputMode || !isInteractive;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createdUrlRef = useRef<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const showWaveform = Boolean(displayUrl);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const originalFileNameRef = useRef<string | null>(widgetValue.name ?? null);
  const baseFileName = stripFileExtension(originalFileNameRef.current ?? widgetValue.name);
  console.log("[WaveformPlaylistInput] baseFileName", {
    originalFileName: originalFileNameRef.current,
    widgetValueName : widgetValue.name,
    baseFileName,
  });

  // Maintain a display URL, preferring explicit URLs while revoking auto-created ones.
  useEffect(() => {
    const nextValue = normalizeWaveformValue(widgetValue);
    if (nextValue.url) {
      if (createdUrlRef.current && createdUrlRef.current !== nextValue.url) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
      setDisplayUrl(nextValue.url);
      return;
    }
    if (nextValue.file) {
      if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current);
      createdUrlRef.current = URL.createObjectURL(nextValue.file);
      setDisplayUrl(createdUrlRef.current);
      return;
    }
    if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current);
    createdUrlRef.current = null;
    setDisplayUrl(null);
  }, [widgetValue]);

  // Cleanup any object URLs generated by this widget.
  useEffect(() => {
    return () => {
      if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current);
      createdUrlRef.current = null;
    };
  }, []);

  // Reset the native input when the value is cleared to allow re-selecting the same file.
  useEffect(() => {
    if (!widgetValue.file && inputRef.current) inputRef.current.value = "";
  }, [widgetValue.file]);

  // Decode the uploaded audio into a single-track playlist for clip editing.
  useEffect(() => {
    let cancelled = false;
    async function decodeAudio() {
      if (!widgetValue.file) {
        setTracks([]);
        setDecodeError(null);
        setIsDecoding(false);
        return;
      }
      setIsDecoding(true);
      setDecodeError(null);
      try {
        const audioContext = getGlobalAudioContext();
        const arrayBuffer = await widgetValue.file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        if (cancelled) return;
        const trackName = widgetValue.name ?? "Audio Track";
        const newTrack = buildTrackFromAudioBuffer(audioBuffer, trackName);
        clipNameByIdRef.current.clear();
        const normalized = normalizeClipMetadata([newTrack], clipNameByIdRef.current);
        setTracks(assignClipColors(normalized));
        setFitSamplesPerPixel(null);
        setSelectedClipId(null);
        setIsDecoding(false);
      } catch (error) {
        if (cancelled) return;
        setTracks([]);
        setIsDecoding(false);
        setDecodeError(error instanceof Error ? error.message : "Audio decode failed");
      }
    }

    void decodeAudio();
    return () => {
      cancelled = true;
    };
  }, [widgetValue.file, widgetValue.name]);

  // Track waveform container width to fit the full timeline on load.
  useEffect(() => {
    if (!showWaveform || tracks.length === 0) return;
    const container = waveformContainerRef.current;
    if (!container) {
      console.log("[WaveformPlaylistInput] waveform width: container missing");
      return;
    }
    const updateWidth = () => {
      const width = container.clientWidth || 0;
      setWaveformWidth(width);
      console.log("[WaveformPlaylistInput] waveform width", { width });
    };
    updateWidth();
    console.log("[WaveformPlaylistInput] waveform width observer attached");
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [showWaveform, tracks.length]);

  // Set the initial samplesPerPixel so the full timeline fits after load.
  useEffect(() => {
    const fitValue = calculateFitSamplesPerPixel(tracks, waveformWidth);
    if (fitValue === null) return;
    console.log("[WaveformPlaylistInput] set fitSamplesPerPixel", { fitValue });
    setFitSamplesPerPixel(fitValue);
  }, [tracks, waveformWidth]);

  // Expose getValue for handler execution using the latest stored value.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: WaveformPlaylistInputOutputValue) => {
      const nextValue = normalizeWaveformValue(newValue);
      widgetValueRef.current = nextValue;
      setWidgetValue(nextValue);
      setSelectedClipId(null);
      if (!nextValue.file) setTracks([]);
    },
  }), []);

  // Sync clip edits back into the widget value for handler consumption.
  useEffect(() => {
    if (!widgetValueRef.current.file) return;
    const clips = buildClipOutput(tracks);
    if (areClipOutputsEqual(widgetValueRef.current.clips, clips)) return;
    const nextValue = { ...widgetValueRef.current, clips };
    setWidgetValue(nextValue);
    widgetValueRef.current = nextValue;
    if (!isReadOnly) onChange(id, nextValue);
  }, [tracks, isReadOnly, onChange, id]);

  // Apply per-clip colors to waveform headers once the DOM updates.
  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container) return;
    applyClipColorStyles(container, tracks);
    let rafId: number | null = null;
    let mutationCount = 0;
    let lastLogTime = 0;
    const observer = new MutationObserver(() => {
      mutationCount += 1;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const changed = applyClipColorStyles(container, tracks);
        const now = Date.now();
        if (now - lastLogTime > 1000) {
          lastLogTime = now;
          console.log("[WaveformPlaylistInput] mutation tick", { mutationCount, changed });
        }
        if (!changed) return;
        if (mutationCount > 2000) observer.disconnect();
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [tracks]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      event.preventDefault();
      event.currentTarget.value = "";
      return;
    }
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      const emptyValue = buildEmptyWaveformValue();
      setWidgetValue(emptyValue);
      widgetValueRef.current = emptyValue;
      onChange(id, emptyValue);
      return;
    }
    if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current);
    const nextUrl = URL.createObjectURL(nextFile);
    createdUrlRef.current = nextUrl;
    originalFileNameRef.current = nextFile.name;
    console.log("[WaveformPlaylistInput] file upload", { fileName: nextFile.name });
    const nextValue = buildWaveformValueFromFile(nextFile, nextUrl);
    setWidgetValue(nextValue);
    widgetValueRef.current = nextValue;
    onChange(id, nextValue);
    event.currentTarget.value = "";
  }

  function handleDownload() {
    if (!displayUrl) return;
    const link = document.createElement("a");
    link.href = displayUrl;
    link.download = widgetValue.name ?? "audio";
    link.rel = "noopener";
    link.click();
  }

  // Normalize track updates and keep selection in sync with clip changes.
  function handleTracksChange(nextTracks: ClipTrack[]) {
    const normalized = assignClipColors(normalizeClipMetadata(nextTracks, clipNameByIdRef.current));
    setTracks(normalized);
    if (selectedClipId) {
      const stillExists = normalized.some((track) => track.clips.some((clip) => clip.id === selectedClipId));
      if (!stillExists) {
        setSelectedClipId(null);
      }
    }
  }

  // Store the selected clip so delete actions can target it.
  function handleSelectClip(clipId: string) {
    setSelectedClipId(clipId);
  }

  // Merge the selected clip with its neighbor to cancel a split.
  function handleCancelClip() {
    if (!selectedClipId) return;
    const nextTracks = tracks.map((track) => {
      const sorted = [...track.clips].sort((a, b) => a.startSample - b.startSample);
      const index = sorted.findIndex((clip) => clip.id === selectedClipId);
      if (index === -1) return track;
      const prev = sorted[index - 1] ?? null;
      const current = sorted[index];
      const next = sorted[index + 1] ?? null;
      const mergeWithPrev = prev ?? null;
      const mergeWithNext = !mergeWithPrev ? next : null;
      if (!mergeWithPrev && !mergeWithNext) return track;
      const base = mergeWithPrev ?? current;
      const other = mergeWithPrev ? current : mergeWithNext!;
      const merged = {
        ...base,
        startSample    : Math.min(base.startSample, other.startSample),
        durationSamples: base.durationSamples + other.durationSamples,
        offsetSamples  : Math.min(base.offsetSamples, other.offsetSamples),
        name           : base.name ?? other.name,
        color          : base.color ?? other.color,
      };
      const remaining = sorted.filter((clip) => clip.id !== base.id && clip.id !== other.id);
      return { ...track, clips: [...remaining, merged].sort((a, b) => a.startSample - b.startSample) };
    });
    setSelectedClipId(null);
    handleTracksChange(nextTracks);
  }

  // Remove the selected clip entirely.
  function handleDeleteClip() {
    if (!selectedClipId) return;
    const nextTracks = tracks
      .map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.id !== selectedClipId),
      }))
      .filter((track) => track.clips.length > 0);
    setSelectedClipId(null);
    handleTracksChange(nextTracks);
  }

  // Update clip name across waveform and list.
  function handleRenameClip(clipId: string, name: string) {
    clipNameByIdRef.current.set(clipId, name);
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => (
        clip.id === clipId
          ? { ...clip, name }
          : clip
      )),
    }));
    handleTracksChange(nextTracks);
  }

  const hasTrackInfo = Boolean(widgetValue.name || widgetValue.type || widgetValue.size || widgetValue.lastModified);
  const errorMessage = decodeError ? `Waveform load failed: ${decodeError}` : null;
  return (
    <div className={cn("group space-y-2", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`tool-input-${id}`} className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
          <SafeHtml html={title} />
        </label>
        <div className="flex items-center gap-2">
          <label
            htmlFor={`tool-input-${id}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition",
              isReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/60 hover:text-primary"
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Select Audio
          </label>
        </div>
      </div>
      {description && <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>}
      <input
        id={`tool-input-${id}`}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={title}
        disabled={isReadOnly}
        onChange={handleFileChange}
      />
      <div className="rounded-md border border-border/70 bg-card/60 p-3">
        {!showWaveform && (
          <div className="text-[11px] text-muted-foreground">No audio selected yet.</div>
        )}
        {showWaveform && (
          <div className="space-y-2">
            {isDecoding && <div className="text-[11px] text-muted-foreground">Loading waveform...</div>}
            {errorMessage && <div className="text-[11px] text-destructive">{errorMessage}</div>}
            {!isDecoding && !errorMessage && tracks.length > 0 && (
              <WaveformPlaylistProvider
                key={`playlist-${fitSamplesPerPixel ?? "default"}`}
                tracks={tracks}
                waveHeight={waveHeight}
                samplesPerPixel={fitSamplesPerPixel ?? samplesPerPixel}
                zoomLevels={zoomLevels}
                controls={{ show: false, width: 0 }}
              >
                <div className="space-y-2">
                  <KeyboardShortcuts enabled={!isReadOnly} />
                  {showControls && (
                    <WaveformControlsRow
                      disabled={isReadOnly}
                      tracks={tracks}
                      onTracksChange={handleTracksChange}
                    />
                  )}
                  <WaveformClipCanvas
                    tracks={tracks}
                    onTracksChange={handleTracksChange}
                    isReadOnly={isReadOnly}
                    onSelectClip={handleSelectClip}
                    containerRef={waveformContainerRef}
                  />
                  <ClipList
                    tracks={tracks}
                    selectedClipId={selectedClipId}
                    onSelectClip={handleSelectClip}
                    onRenameClip={handleRenameClip}
                    onCancelClip={handleCancelClip}
                    onDeleteClip={handleDeleteClip}
                    baseFileName={baseFileName}
                  />
                  {hasTrackInfo && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <div className="font-medium text-foreground">Name</div>
                      <div>{widgetValue.name ?? "Untitled audio"}</div>
                      <div className="font-medium text-foreground">Type</div>
                      <div>{widgetValue.type || "unknown"}</div>
                      <div className="font-medium text-foreground">Size</div>
                      <div>{formatBytes(widgetValue.size)}</div>
                      <div className="font-medium text-foreground">Last modified</div>
                      <div>{formatTimestamp(widgetValue.lastModified)}</div>
                    </div>
                  )}
                </div>
              </WaveformPlaylistProvider>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
