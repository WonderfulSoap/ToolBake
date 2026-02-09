/**
 * Label Dynamic Demo - demonstrates LabelInput's interactive capabilities
 *
 * Features:
 * - Dynamic HTML rendering with afterHook for event binding
 * - data-* attribute collection via getValue()
 * - State persistence across handler executions
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  // Read current count from label's collected data-* attributes
  const labelState = inputWidgets["counter-label"];
  let count = readCountFromState(labelState);

  console.log(`[handler] readCountFromState: ${count}`);


  // // Handle reset button click
  // if (changedWidgetIds === "reset-btn") {
  //   count = 0;
  // }

  // Build status message
  const statusHtml = buildStatusHtml(changedWidgetIds, count);
  console.log(`[handler] buildStatusHtml: ${statusHtml}`);
  console.log(`[handler] buildCounterLabel: ${buildCounterLabel(count)}`);

  return {
    "counter-label": buildCounterLabel(count),
    "status"       : statusHtml,
  };
}

/**
 * Read count value from label's collected data state
 */
function readCountFromState(value) {
  if (!value || typeof value !== "object") return 0;
  const data = value.data;
  if (!data || typeof data !== "object") return 0;

  // data structure: { "counter-container": { count: "5" } }
  const containerData = data["counter-container"];
  if (!containerData || typeof containerData !== "object") return 0;

  const raw = containerData["data-count"];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build the interactive counter label with afterHook
 */
function buildCounterLabel(count) {
  const safeCount = Number.isFinite(count) ? count : 0;

  const innerHtml = `
    <div id="counter-container" data-count="${safeCount}" class="space-y-3">
      <div class="flex items-center gap-4">
        <span class="text-2xl font-bold text-foreground" id="count-display">${safeCount}</span>
        <div class="flex gap-2">
          <button id="dec-btn" class="inline-flex items-center justify-center rounded-md bg-muted px-3 py-1 text-sm font-medium hover:bg-muted/80 transition-colors">-</button>
          <button id="inc-btn" class="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-1 text-sm font-medium hover:bg-primary/90 transition-colors">+</button>
        </div>
      </div>
      <div class="text-xs text-muted-foreground">
        Click buttons to change count. State persists via <code class="rounded bg-muted px-1 py-0.5 font-mono">data-*</code> attributes.
      </div>
    </div>
  `;

  // afterHook binds click events after DOM is rendered
  const afterHook = (container) => {
    console.log("[LabelInput] id: counter-label, inside afterHook: start");
    const incBtn = container.querySelector("#inc-btn");
    const decBtn = container.querySelector("#dec-btn");
    const countDisplay = container.querySelector("#count-display");
    const counterContainer = container.querySelector("#counter-container");
    console.log(`[LabelInput] id: counter-label, inside afterHook: incBtn: ${incBtn}, decBtn: ${decBtn}, countDisplay: ${countDisplay}, counterContainer: ${counterContainer}`);

    if (!incBtn || !decBtn || !countDisplay || !counterContainer) return;

    const updateCount = (delta) => {
      console.log(`[LabelInput] id: counter-label, inside btn is clicked, delta: ${delta}`);
      const current = Number(counterContainer.dataset.count || "0");
      const next = Math.max(0, current + delta);
      counterContainer.dataset.count = String(next);
      countDisplay.textContent = String(next);
    };


    console.log("[LabelInput] id: counter-label, inside addEventListener: start");
    incBtn.addEventListener("click", () => updateCount(1));
    decBtn.addEventListener("click", () => updateCount(-1));
    console.log("[LabelInput] id: counter-label, inside addEventListener: end");
  };

  return { innerHtml, afterHook };
}

/**
 * Build status message showing current state
 */
function buildStatusHtml(changedWidgetIds, count) {
  const trigger = changedWidgetIds === undefined ? "initial load" : changedWidgetIds;
  return `<div class="text-xs space-y-1">
    <div><span class="text-muted-foreground">Triggered by:</span> <code class="rounded bg-muted px-1 py-0.5 font-mono">${trigger}</code></div>
    <div><span class="text-muted-foreground">Count from data-*:</span> <span class="font-semibold">${count}</span></div>
  </div>`;
}
