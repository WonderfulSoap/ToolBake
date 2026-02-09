/**
 * Raw HTML Script Showcase - demonstrates RawHtmlInput execution with inline scripts.
 *
 * Features:
 * - Raw HTML rendering without sanitization
 * - Inline onclick handlers that mutate DOM state
 * - data-* collection for syncing UI state back into handler
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const rawState = inputWidgets["raw-html-preview"];
  let count = Number(rawState?.data?.["raw-html-counter"]?.["data-count"]);
  const chartValues = readChartValues(rawState);

  console.log(`[handler] readCountFromState: ${count}`);
  console.log(`[handler] readChartValues: ${chartValues.join(",")}`);

  const statusHtml = buildStatusHtml(changedWidgetIds, count, chartValues);
  console.log(`[handler] buildStatusHtml: ${statusHtml}`);

  if (changedWidgetIds === "sync-btn") {
    return { "status": statusHtml };
  }

  return {
    "raw-html-preview": buildRawHtmlCounter(count),
    "status"          : statusHtml,
  };
}

/**
 * Read chart values from RawHtmlInput collected data.
 */
function readChartValues(value) {
  const raw = value?.data?.["raw-html-counter"]?.["data-values"] ?? "";
  return raw.split(",").map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

/**
 * Build RawHtmlInput payload with inline onclick handlers.
 */
function buildRawHtmlCounter(count) {
  const safeCount = Number.isFinite(count) ? count : 0;

  const innerHtml = `
    <div id="raw-html-counter" data-count="${safeCount}" class="space-y-3">
      <div class="text-xs text-muted-foreground">
        Randomized chart values are generated in the inline script and stored in <code class="rounded bg-muted px-1 py-0.5 font-mono">data-values</code>.
      </div>
      <div id="raw-html-dashboard" class="mt-2 rounded-md border border-border/60 bg-muted/30 p-3"></div>
    </div>
    <script>
      (function() {
        console.log("[RawHtmlInput] Inline script executed.");
        var root = document.getElementById("raw-html-counter");
        var dashboard = document.getElementById("raw-html-dashboard");
        console.log("[RawHtmlInput] root:", root, "dashboard:", dashboard);
        if (root) root.dataset.scriptExecuted = "true";
        if (!root || !dashboard) {
          console.log("[RawHtmlInput] missing root or dashboard, abort render.");
          return;
        }

        var value = Number(root.dataset.count || "0");
        console.log("[RawHtmlInput] data-count:", root.dataset.count, "parsed:", value);
        var existingValues = root.dataset.values || "";
        var values = existingValues ? existingValues.split(",").map(function(item) { return Number(item); }).filter(function(item) { return Number.isFinite(item); }) : [];
        if (!values.length) values = buildRandomValues(8);
        root.dataset.values = values.join(",");
        console.log("[RawHtmlInput] data-values:", root.dataset.values);

        var palette = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"];
        var bars = values.map(function(item) { return Math.max(6, Math.min(64, Math.round(item))); });
        console.log("[RawHtmlInput] bars:", bars);

        var style = document.createElement("style");
        style.textContent = [
          "#raw-html-dashboard .raw-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.6)}",
          "#raw-html-dashboard .raw-title{font-size:12px;color:var(--muted-foreground)}",
          "#raw-html-dashboard .raw-value{font-size:18px;font-weight:700}",
          "#raw-html-dashboard .raw-bar{height:10px;border-radius:999px;background:linear-gradient(90deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18))}",
          "#raw-html-dashboard .raw-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
          "#raw-html-dashboard .raw-actions button{padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;background:rgba(15,23,42,0.08)}",
          "#raw-html-dashboard .raw-bars{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;align-items:end;height:56px}",
          "#raw-html-dashboard .raw-bars span{display:block;border-radius:6px;transition:height .2s ease}"
        ].join("");

        var list = document.createElement("ul");
        list.style.marginTop = "10px";
        list.style.display = "grid";
        list.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
        list.style.gap = "6px";
        list.style.fontSize = "12px";
        for (var i = 0; i < 6; i++) {
          var li = document.createElement("li");
          li.style.padding = "6px 8px";
          li.style.borderRadius = "6px";
          li.style.background = "rgba(255,255,255,0.55)";
          li.textContent = "Node " + (i + 1) + " · " + values[i % values.length];
          list.appendChild(li);
        }

        var barsWrap = document.createElement("div");
        barsWrap.className = "raw-bars";
        bars.forEach(function(height, idx) {
          var bar = document.createElement("span");
          bar.style.height = height + "px";
          bar.style.background = palette[idx % palette.length];
          barsWrap.appendChild(bar);
        });

        var actions = document.createElement("div");
        actions.className = "raw-actions";
        var regenButton = document.createElement("button");
        regenButton.type = "button";
        regenButton.textContent = "Regenerate Data";
        regenButton.addEventListener("click", function() {
          var next = buildRandomValues(8);
          root.dataset.values = next.join(",");
          console.log("[RawHtmlInput] regenerate data:", root.dataset.values);
          barsWrap.replaceChildren();
          next.forEach(function(nextValue, idx) {
            var bar = document.createElement("span");
            bar.style.height = Math.max(6, Math.min(64, Math.round(nextValue))) + "px";
            bar.style.background = palette[idx % palette.length];
            barsWrap.appendChild(bar);
          });
          var items = list.querySelectorAll("li");
          items.forEach(function(item, idx) {
            item.textContent = "Node " + (idx + 1) + " · " + next[idx % next.length];
          });
        });
        actions.appendChild(regenButton);

        dashboard.replaceChildren(style, list, barsWrap, actions);
        console.log("[RawHtmlInput] dashboard rendered.", dashboard);

        function buildRandomValues(size) {
          var result = [];
          for (var i = 0; i < size; i++) result.push(10 + Math.floor(Math.random() * 50));
          return result;
        }
      })();
    </script>
  `;

  return { innerHtml };
}

/**
 * Build status message showing trigger and current counter.
 */
function buildStatusHtml(changedWidgetIds, count, chartValues) {
  const trigger = changedWidgetIds === undefined ? "initial load" : changedWidgetIds;
  const valueDisplay = chartValues.length ? chartValues.join(", ") : "No synced data";
  return `<div class="text-xs space-y-1">
    <div><span class="text-muted-foreground">Triggered by:</span> <code class="rounded bg-muted px-1 py-0.5 font-mono">${trigger}</code></div>
    <div><span class="text-muted-foreground">Count from data-*:</span> <span class="font-semibold">${count}</span></div>
    <div><span class="text-muted-foreground">Chart values:</span> <span class="font-semibold">${valueDisplay}</span></div>
  </div>`;
}
