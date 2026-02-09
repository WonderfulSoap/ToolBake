/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Checks the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 * - The 'handler.d.ts' tab shows the full auto generated type definitions for the handler function
 * 
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  // Normalize inputs into a compact view model for the label renderer.
  const title = toSafeText(inputWidgets["scene-title"], "Untitled Scene");
  const story = toSafeText(inputWidgets["story-body"], "");
  const tone = toSafeText(inputWidgets["tone-mode"], "neutral");
  const accent = toSafeText(inputWidgets["accent-style"], "sky");
  const tags = Array.isArray(inputWidgets["action-tags"]) ? inputWidgets["action-tags"] : [];
  const progress = clampNumber(inputWidgets["progress-meter"], 0, 100, 0);
  const queueSize = clampNumber(inputWidgets["queue-size"], 0, 99, 0);
  const showDialog = Boolean(inputWidgets["show-dialog"]);
  const dialogTriggered = changedWidgetIds === "open-dialog";
  const dialogVisible = showDialog || dialogTriggered;
  const toneConfig = getToneConfig(tone);
  const accentConfig = getAccentConfig(accent);
  const timestamp = new Date().toLocaleTimeString();
  const imageFile = normalizeFileInput(inputWidgets["image-file"]);
  const imageDataUrl = imageFile ? await fileToDataURL(imageFile) : null;
  const imageRotationDeg = readLabelRotation(inputWidgets["label-preview"]);
  console.log(`label-preview: ${JSON.stringify(inputWidgets)}`);


  console.log("label-showcase", { changedWidgetIds, tone, accent, dialogVisible });

  // Compose the main label content with rich HTML and layout blocks.
  const previewPayload = buildPreviewPayload({
    title,
    story,
    toneConfig,
    accentConfig,
    tags,
    progress,
    queueSize,
    imageDataUrl,
    dialogVisible,
    timestamp,
    imageRotationDeg,
  });

  // Compose a compact interaction trace for quick feedback.
  const activityHtml = buildActivityHtml({
    changedWidgetIds,
    dialogTriggered,
    showDialog,
    toneConfig,
    timestamp,
    imageRotationDeg,
  });

  return {
    "label-preview" : previewPayload,
    "label-activity": activityHtml,
  };
}

function buildPreviewPayload(payload) {
  const tagHtml = buildTagHtml(payload.tags, payload.accentConfig.tag);
  const meterHtml = buildMeterHtml(payload.progress, payload.accentConfig.segment, payload.accentConfig.segmentMuted);
  const storyHtml = payload.story
    ? "<div class='text-sm text-foreground leading-relaxed'>" + escapeHtml(payload.story) + "</div>"
    : "<div class='text-sm text-muted-foreground'>No story text provided yet.</div>";
  const dialogHtml = payload.dialogVisible ? buildDialogHtml(payload) : "";
  // Image rotation preview section driven by upload + slider inputs.
  const imageHtml = buildImagePreviewHtml(payload.imageDataUrl, payload.imageRotationDeg);
  const inlineButtonHtml =
    "<button class='inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs font-medium text-foreground' data-label-action='toggle' data-label-target='label-inline-dialog'>Open Dialog</button>";
  const inlinePanelButtonHtml =
    "<button class='inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs font-medium text-foreground' data-label-action='toggle' data-label-target='label-inline-popup'>Open Popup</button>";
  const inlineIframeButtonHtml =
    "<button class='inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs font-medium text-foreground' data-label-action='toggle' data-label-target='label-inline-iframe'>Open Iframe</button>";
  const overlayButtonHtml =
    "<button class='inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs font-medium text-foreground' data-label-action='toggle' data-label-target='label-overlay'>Open Overlay</button>";
  const inlinePanelHtml =
    "<div data-label-id='label-inline-dialog' class='hidden rounded-md border border-border bg-background p-3'>" +
    "<div class='text-sm font-semibold text-foreground'>Inline Dialog</div>" +
    "<div class='mt-1 text-xs text-muted-foreground'>This dialog is rendered inside LabelInput HTML.</div>" +
    "<button class='mt-2 text-xs text-primary underline underline-offset-2' data-label-action='close' data-label-target='label-inline-dialog'>Close</button>" +
    "</div>";
  const inlinePopupHtml =
    "<div data-label-id='label-inline-popup' class='hidden rounded-md border border-border bg-background p-3 shadow-lg'>" +
    "<div class='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Popup Preview</div>" +
    "<div class='mt-2 text-sm text-foreground'>This popup is rendered inside the label.</div>" +
    "<div class='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-muted/60 px-2 py-0.5 text-[11px] uppercase tracking-wide'>Quick action</span>" +
    "<button class='text-xs text-primary underline underline-offset-2' data-label-action='close' data-label-target='label-inline-popup'>Dismiss</button>" +
    "</div>" +
    "</div>";
  const iframeDoc =
    "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;font-family:ui-sans-serif,system-ui;background:#f8fafc;color:#0f172a;'>" +
    "<div style='padding:12px;'>" +
    "<div style='font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;'>Iframe Popup</div>" +
    "<div style='margin-top:8px;font-size:14px;'>This mini layer runs inside an iframe.</div>" +
    "<button style='margin-top:10px;padding:6px 10px;font-size:12px;border-radius:6px;border:1px solid #cbd5f5;background:#eef2ff;color:#1e1b4b;cursor:pointer;' onclick='window.parent.postMessage({source:\"label-iframe\",action:\"close\"},\"*\")'>Close</button>" +
    "</div></body></html>";
  const inlineIframeHtml =
    "<div data-label-id='label-inline-iframe' class='hidden rounded-md border border-border bg-background p-3 shadow-lg'>" +
    "<iframe title='Inline popup iframe' class='w-full h-40 rounded-md border border-border' sandbox='allow-scripts' srcdoc=\"" + escapeHtml(iframeDoc) + "\"></iframe>" +
    "</div>";
  const checklistHtml =
    "<div class='space-y-2 rounded-md border border-border bg-muted/30 p-3'>" +
    "<div class='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Checklist</div>" +
    "<label class='flex items-center gap-2 text-sm text-foreground'><input type='checkbox' class='h-4 w-4 rounded border-border'/>Notify stakeholders</label>" +
    "<label class='flex items-center gap-2 text-sm text-foreground'><input type='checkbox' class='h-4 w-4 rounded border-border'/>Capture timeline</label>" +
    "<label class='flex items-center gap-2 text-sm text-foreground'><input type='checkbox' class='h-4 w-4 rounded border-border'/>Share follow-up doc</label>" +
    "</div>";
  const statsHtml =
    "<div class='grid grid-cols-3 gap-2'>" +
    "<div class='rounded-md border border-border bg-background p-2 text-center'>" +
    "<div class='text-xs text-muted-foreground'>Latency</div>" +
    "<div class='text-sm font-semibold text-foreground'>142ms</div>" +
    "</div>" +
    "<div class='rounded-md border border-border bg-background p-2 text-center'>" +
    "<div class='text-xs text-muted-foreground'>Errors</div>" +
    "<div class='text-sm font-semibold text-foreground'>0.12%</div>" +
    "</div>" +
    "<div class='rounded-md border border-border bg-background p-2 text-center'>" +
    "<div class='text-xs text-muted-foreground'>Queue</div>" +
    "<div class='text-sm font-semibold text-foreground'>" + payload.queueSize + "</div>" +
    "</div>" +
    "</div>";
  const badgesHtml =
    "<div class='flex flex-wrap gap-2'>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-muted/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground'>SLA</span>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-700'>Pending</span>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-emerald-700'>Stable</span>" +
    "</div>";
  const timelineHtml =
    "<div class='space-y-2 rounded-md border border-border bg-muted/30 p-3'>" +
    "<div class='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Timeline</div>" +
    "<div class='space-y-2'>" +
    "<div class='flex items-start gap-2 text-sm text-foreground'><span class='mt-1 h-2 w-2 rounded-full bg-sky-500'></span>Alert acknowledged</div>" +
    "<div class='flex items-start gap-2 text-sm text-foreground'><span class='mt-1 h-2 w-2 rounded-full bg-amber-500'></span>Mitigation in progress</div>" +
    "<div class='flex items-start gap-2 text-sm text-foreground'><span class='mt-1 h-2 w-2 rounded-full bg-muted'></span>Postmortem scheduled</div>" +
    "</div>" +
    "</div>";
  const quickActionsHtml =
    "<div class='space-y-2 rounded-md border border-border bg-background p-3'>" +
    "<div class='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Quick Actions</div>" +
    "<div class='flex flex-wrap gap-2'>" +
    "<button class='inline-flex items-center rounded-sm border border-border px-2 py-1 text-xs text-foreground' data-label-action='toggle' data-label-target='label-inline-dialog'>Reopen dialog</button>" +
    "<button class='inline-flex items-center rounded-sm border border-border px-2 py-1 text-xs text-foreground' data-label-action='toggle' data-label-target='label-overlay'>Show overlay</button>" +
    "<button class='inline-flex items-center rounded-sm border border-border px-2 py-1 text-xs text-foreground' data-label-action='toggle' data-label-target='label-inline-popup'>Ping popup</button>" +
    "</div>" +
    "</div>";
  const alertHtml =
    "<div class='rounded-md border border-rose-200/60 bg-rose-500/10 p-3 text-sm text-rose-700'>" +
    "<div class='font-semibold'>Heads up</div>" +
    "<div class='mt-1 text-xs text-rose-700/80'>Traffic spike detected. Use the controls above to broadcast status.</div>" +
    "</div>";
  const overlayHtml =
    "<div data-label-id='label-overlay' class='hidden absolute inset-0 z-10'>" +
    "<div class='absolute inset-0 rounded-md bg-black/45 backdrop-blur-sm'></div>" +
    "<div class='relative z-10 flex h-full w-full items-center justify-center p-4'>" +
    "<div class='w-full max-w-sm rounded-md border border-border bg-background p-4 shadow-lg'>" +
    "<div class='text-sm font-semibold text-foreground'>Label Overlay Dialog</div>" +
    "<div class='mt-2 text-xs text-muted-foreground'>This dialog covers the full label area.</div>" +
    "<div class='mt-3 flex items-center justify-between text-xs text-muted-foreground'>" +
    "<span>Inline overlay action</span>" +
    "<button class='text-xs text-primary underline underline-offset-2' data-label-action='close' data-label-target='label-overlay'>Close</button>" +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>";

  const innerHtml = (
    "<div class='space-y-3'>" +
    "<div class='flex items-center justify-between gap-2'>" +
    "<div class='text-sm font-semibold text-foreground'>" + escapeHtml(payload.title) + "</div>" +
    "<span class='" + payload.toneConfig.badge + "'>" + payload.toneConfig.label + "</span>" +
    "</div>" +
    "<div class='rounded-md border border-border bg-muted/30 p-3 space-y-2'>" +
    storyHtml +
    "<div class='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-muted/60 px-2 py-1 text-[11px] uppercase tracking-wide'>queue " + payload.queueSize + "</span>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-muted/60 px-2 py-1 text-[11px] uppercase tracking-wide'>updated " + payload.timestamp + "</span>" +
    "</div>" +
    "<div class='flex items-center gap-2'>" + meterHtml +
    "<span class='text-xs text-muted-foreground'>" + payload.progress + "%</span>" +
    "</div>" +
    "</div>" +
    "<div class='space-y-2'>" +
    "<div class='text-xs font-medium text-foreground'>Live Tags</div>" +
    tagHtml +
    "</div>" +
    "<div class='space-y-2'>" +
    inlineButtonHtml +
    inlinePanelButtonHtml +
    inlineIframeButtonHtml +
    overlayButtonHtml +
    inlinePanelHtml +
    inlinePopupHtml +
    inlineIframeHtml +
    overlayHtml +
    "</div>" +
    imageHtml +
    checklistHtml +
    statsHtml +
    badgesHtml +
    timelineHtml +
    quickActionsHtml +
    alertHtml +
    dialogHtml +
    "<div class='text-xs text-muted-foreground'>Tip: toggle dialog mode or click Preview Dialog to simulate an overlay.</div>" +
    "</div>"
  );
  return { innerHtml, script: buildImageRotationScript(payload.imageRotationDeg) };
}

function buildActivityHtml(payload) {
  const triggerLabel = payload.changedWidgetIds ? escapeHtml(payload.changedWidgetIds) : "initial-load";
  const dialogLabel = payload.dialogTriggered ? "Dialog triggered" : payload.showDialog ? "Dialog pinned" : "Dialog idle";

  return (
    "<div class='space-y-1 text-xs text-muted-foreground'>" +
    "<div class='flex items-center justify-between gap-2'>" +
    "<span class='font-semibold text-foreground'>Last trigger</span>" +
    "<span class='inline-flex items-center gap-1 rounded-sm bg-muted/60 px-2 py-0.5 text-[11px] uppercase tracking-wide'>" + triggerLabel + "</span>" +
    "</div>" +
    "<div class='flex items-center justify-between gap-2'>" +
    "<span class='font-semibold text-foreground'>Tone</span>" +
    "<span class='" + payload.toneConfig.badge + "'>" + payload.toneConfig.label + "</span>" +
    "</div>" +
    "<div class='flex items-center justify-between gap-2'>" +
    "<span class='font-semibold text-foreground'>Dialog</span>" +
    "<span class='text-muted-foreground'>" + dialogLabel + "</span>" +
    "</div>" +
    "<div class='flex items-center justify-between gap-2'>" +
    "<span class='font-semibold text-foreground'>Image rotation</span>" +
    "<span class='text-muted-foreground'>" + payload.imageRotationDeg + "deg</span>" +
    "</div>" +
    "<div class='text-[11px] text-muted-foreground'>" + escapeHtml(payload.timestamp) + "</div>" +
    "</div>"
  );
}

/**
 * Build an image preview block with a rotation transform.
 */
function buildImagePreviewHtml(dataUrl, rotationDeg) {
  if (!dataUrl) {
    return (
      "<div class='rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground'>" +
      "Upload an image to see the rotation preview here." +
      "</div>"
    );
  }
  const safeRotation = clampNumber(rotationDeg, 0, 360, 0);
  return (
    "<div class='rounded-md border border-border bg-muted/30 p-3 space-y-2'>" +
    "<div class='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Image Rotation</div>" +
    "<div class='h-56 w-full flex items-center justify-center overflow-hidden rounded-md bg-background'>" +
    "<img data-label-image='rotation' src='" + dataUrl + "' alt='Rotation preview' class='max-h-full max-w-full object-contain' style='transform: rotate(" + safeRotation + "deg);'/>" +
    "</div>" +
    "<div class='flex items-center gap-3 text-xs text-muted-foreground'>" +
    "<input data-label-slider='rotation' type='range' min='0' max='360' step='5' value='" + safeRotation + "' class='w-full accent-foreground'/>" +
    "<span data-label-rotation-value>" + safeRotation + "deg</span>" +
    "</div>" +
    "</div>"
  );
}

/**
 * Wire the inline rotation slider to the image preview.
 */
function buildImageRotationScript(initialRotation) {
  const safeRotation = clampNumber(initialRotation, 0, 360, 0);
  return (
    "const slider = container.querySelector(\"[data-label-slider='rotation']\");" +
    "const image = container.querySelector(\"[data-label-image='rotation']\");" +
    "const label = container.querySelector(\"[data-label-rotation-value]\");" +
    "const rotationSource = container.closest(\"[data-rotation]\") || container.querySelector(\"[data-rotation]\");" +
    "if (!slider || !image) return;" +
    "function handleInput() {" +
    "  const value = slider.value || '0';" +
    "  image.style.transform = 'rotate(' + value + 'deg)';" +
    "  if (label) label.textContent = value + 'deg';" +
    "  container.dataset.rotation = value;" +
    "}" +
    "slider.value = " + safeRotation + ";" +
    "if (rotationSource) rotationSource.dataset.rotation = String(slider.value || '" + safeRotation + "');" +
    "handleInput();" +
    "slider.addEventListener('input', handleInput);" +
    "return () => slider.removeEventListener('input', handleInput);"
  );
}

function buildTagHtml(tags, tagClass) {
  if (!tags.length) {
    return "<div class='text-xs text-muted-foreground'>Add tags to build interactive chips.</div>";
  }
  const rendered = tags.map((tag) => "<span class='" + tagClass + "'>" + escapeHtml(String(tag)) + "</span>").join("");
  return "<div class='flex flex-wrap gap-2'>" + rendered + "</div>";
}

function buildMeterHtml(progress, activeClass, mutedClass) {
  const totalBlocks = 10;
  const filledBlocks = Math.round(clampNumber(progress, 0, 100, 0) / 10);
  let blocks = "";
  for (let index = 0; index < totalBlocks; index += 1) {
    const blockClass = index < filledBlocks ? activeClass : mutedClass;
    blocks += "<span class='" + blockClass + "'></span>";
  }
  return "<div class='inline-flex items-center gap-1'>" + blocks + "</div>";
}

function buildDialogHtml(payload) {
  return (
    "<div class='relative mt-3'>" +
    "<div class='absolute inset-0 rounded-md bg-black/40'></div>" +
    "<div class='relative rounded-md border border-border bg-background p-4 shadow-lg' role='dialog' aria-modal='true'>" +
    "<div class='flex items-center justify-between'>" +
    "<span class='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Dialog Preview</span>" +
    "<span class='" + payload.accentConfig.badge + "'>" + payload.toneConfig.label + "</span>" +
    "</div>" +
    "<div class='mt-2 text-sm text-foreground'>Share this update with the rotation and confirm the next step.</div>" +
    "<ul class='list-disc pl-4 space-y-1 text-sm text-muted-foreground mt-2'>" +
    "<li>Send a summary to the incident channel.</li>" +
    "<li>Assign an owner to validate the fix.</li>" +
    "<li>Capture a postmortem note.</li>" +
    "</ul>" +
    "<div class='mt-3 flex items-center justify-between text-xs text-muted-foreground'>" +
    "<span>Press any input to close preview.</span>" +
    "<a class='font-medium text-primary underline underline-offset-2' href='https://example.com' target='_blank'>Docs</a>" +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function getToneConfig(tone) {
  const normalized = String(tone || "").toLowerCase();
  if (normalized === "calm") {
    return { label: "Calm", badge: "inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-emerald-700" };
  }
  if (normalized === "urgent") {
    return { label: "Urgent", badge: "inline-flex items-center gap-1 rounded-sm bg-rose-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-rose-700" };
  }
  return { label: "Neutral", badge: "inline-flex items-center gap-1 rounded-sm bg-muted/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground" };
}

function getAccentConfig(accent) {
  const normalized = String(accent || "").toLowerCase();
  if (normalized === "emerald") {
    return {
      tag         : "inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-emerald-700",
      badge       : "inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-emerald-700",
      segment     : "h-2 w-3 rounded-sm bg-emerald-500",
      segmentMuted: "h-2 w-3 rounded-sm bg-emerald-500/20",
    };
  }
  if (normalized === "amber") {
    return {
      tag         : "inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-700",
      badge       : "inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-700",
      segment     : "h-2 w-3 rounded-sm bg-amber-500",
      segmentMuted: "h-2 w-3 rounded-sm bg-amber-500/20",
    };
  }
  if (normalized === "rose") {
    return {
      tag         : "inline-flex items-center gap-1 rounded-sm bg-rose-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-rose-700",
      badge       : "inline-flex items-center gap-1 rounded-sm bg-rose-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-rose-700",
      segment     : "h-2 w-3 rounded-sm bg-rose-500",
      segmentMuted: "h-2 w-3 rounded-sm bg-rose-500/20",
    };
  }
  return {
    tag         : "inline-flex items-center gap-1 rounded-sm bg-sky-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-sky-700",
    badge       : "inline-flex items-center gap-1 rounded-sm bg-sky-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-sky-700",
    segment     : "h-2 w-3 rounded-sm bg-sky-500",
    segmentMuted: "h-2 w-3 rounded-sm bg-sky-500/20",
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toSafeText(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalize a file widget payload to a single File instance.
 */
function normalizeFileInput(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * Read a File into a Data URL for preview rendering.
 */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Invalid file object"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

// Read the rotation value stored on the label DOM snapshot, if present.
function readLabelRotation(value) {
  if (!value || typeof value !== "object") return 0;
  const data = value.data;
  if (!data || typeof data !== "object") return 0;
  const rotationValue = Array.isArray(data.rotation) ? data.rotation[0] : data.rotation;
  const parsed = Number(rotationValue);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(360, parsed));
}
