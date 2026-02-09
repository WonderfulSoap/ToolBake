/**
 * Blockrain Tetris - renders a classic block game with configurable theme and speed.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const theme = normalizeTheme(inputWidgets["tetris-theme"]);
  const autoplay = Boolean(inputWidgets["tetris-autoplay"]);
  const difficulty = normalizeDifficulty(inputWidgets["tetris-difficulty"]);
  const speed = normalizeSpeed(inputWidgets["tetris-speed"]);

  console.log("[Blockrain] trigger:", changedWidgetIds ?? "initial load");
  console.log("[Blockrain] config:", { theme, autoplay, difficulty, speed });

  return {
    "tetris-stage": {
      innerHtml: buildBlockrainHtml({ theme, autoplay, difficulty, speed }),
    },
  };
}

/**
 * Normalize incoming theme selection for Blockrain.js.
 */
function normalizeTheme(value) {
  const theme = String(value || "").trim().toLowerCase();
  const themes = ["custom", "candy", "modern", "retro", "vim", "monochrome", "gameboy", "aerolab"];
  return themes.includes(theme) ? theme : "retro";
}

/**
 * Normalize difficulty selection for Blockrain.js.
 */
function normalizeDifficulty(value) {
  const difficulty = String(value || "").trim().toLowerCase();
  const levels = ["nice", "normal", "evil"];
  return levels.includes(difficulty) ? difficulty : "normal";
}

/**
 * Clamp speed to a reasonable range to keep gameplay stable.
 */
function normalizeSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return 20;
  return Math.min(40, Math.max(5, Math.round(speed)));
}

/**
 * Build RawHtmlInput payload with Blockrain resources and init script.
 * Includes virtual control buttons for touch devices.
 */
function buildBlockrainHtml(config) {
  const { theme, autoplay, difficulty, speed } = config;

  return `
    <div class="space-y-3">
      <div class="text-xs text-muted-foreground">
        Theme: <span class="font-semibold text-foreground">${theme}</span> ·
        Difficulty: <span class="font-semibold text-foreground">${difficulty}</span> ·
        Autoplay: <span class="font-semibold text-foreground">${autoplay ? "On" : "Off"}</span> ·
        Speed: <span class="font-semibold text-foreground">${speed}</span>
      </div>
      <div class="flex justify-center">
        <div class="relative">
          <div
            id="blockrain-root"
            data-theme="${theme}"
            data-autoplay="${autoplay ? "true" : "false"}"
            data-difficulty="${difficulty}"
            data-speed="${speed}"
            class="h-[520px] w-full max-w-[340px] overflow-hidden rounded-md border border-border/60 bg-black"
          ></div>
          <!-- Virtual D-pad overlay -->
          <div id="touch-controls" class="absolute inset-0 pointer-events-none select-none flex flex-col justify-end items-end pb-3 pr-2">
            <div class="pointer-events-auto flex flex-col items-center gap-0.5">
              <button id="btn-rotate" class="w-9 h-9 rounded-full bg-white/10 text-white/60 font-bold text-base active:bg-white/30 flex items-center justify-center border border-white/20">↑</button>
              <div class="flex items-center gap-0.5">
                <button id="btn-left" class="w-9 h-9 rounded-full bg-white/10 text-white/60 font-bold text-base active:bg-white/30 flex items-center justify-center border border-white/20">←</button>
                <button id="btn-down" class="w-9 h-9 rounded-full bg-white/10 text-white/60 font-bold text-base active:bg-white/30 flex items-center justify-center border border-white/20">↓</button>
                <button id="btn-right" class="w-9 h-9 rounded-full bg-white/10 text-white/60 font-bold text-base active:bg-white/30 flex items-center justify-center border border-white/20">→</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <link href="/assets/blockrainjs/blockrain.min.css" rel="stylesheet">
    <script>
      (async function() {
        var root = document.getElementById("blockrain-root");
        if (!root) {
          console.log("[Blockrain] missing root container.");
          return;
        }

        // Temporarily hide AMD define to prevent jQuery from registering as AMD module.
        // Monaco Editor's loader exposes global define, which conflicts with jQuery's AMD detection.
        var originalDefine = window.define;
        window.define = undefined;

        // Sequential loader: jQuery -> Blockrain -> init.
        await loadScript("/assets/blockrainjs/jquery.min.js");
        await loadScript("/assets/blockrainjs/blockrain.jquery.min.js");

        // Restore AMD define after jQuery is loaded.
        window.define = originalDefine;

        var $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.blockrain) {
          console.log("[Blockrain] dependencies not ready.", $);
          return;
        }

        var autoplay = root.dataset.autoplay === "true";
        var theme = root.dataset.theme || "retro";
        var difficulty = root.dataset.difficulty || "normal";
        var speed = Number(root.dataset.speed || "20");

        console.log("[Blockrain] init", { autoplay: autoplay, theme: theme, difficulty: difficulty, speed: speed });

        $(root).blockrain({
          autoplay: autoplay,
          autoplayRestart: true,
          showFieldOnStart: true,
          theme: theme,
          difficulty: difficulty,
          speed: speed
        });

        // Setup virtual control buttons for touch devices
        setupTouchControls(root);

        function loadScript(src) {
          return new Promise(function(resolve, reject) {
            var script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = function() { resolve(); };
            script.onerror = function() { reject(src); };
            document.head.appendChild(script);
          });
        }

        /**
         * Setup touch control buttons to simulate keyboard events.
         * Blockrain listens to keydown events on the game container.
         */
        function setupTouchControls(gameRoot) {
          var controls = {
            "btn-left": { key: "ArrowLeft", keyCode: 37 },
            "btn-right": { key: "ArrowRight", keyCode: 39 },
            "btn-down": { key: "ArrowDown", keyCode: 40 },
            "btn-rotate": { key: "ArrowUp", keyCode: 38 }
          };

          Object.keys(controls).forEach(function(btnId) {
            var btn = document.getElementById(btnId);
            if (!btn) return;

            var keyInfo = controls[btnId];

            // Simulate keydown event on button press
            function triggerKey() {
              var event = new KeyboardEvent("keydown", {
                key: keyInfo.key,
                keyCode: keyInfo.keyCode,
                which: keyInfo.keyCode,
                bubbles: true,
                cancelable: true
              });
              // Dispatch to document since Blockrain listens globally
              document.dispatchEvent(event);
              console.log("[Blockrain] touch control:", btnId, keyInfo.key);
            }

            // Handle both click and touch events
            btn.addEventListener("click", function(e) {
              e.preventDefault();
              triggerKey();
            });

            // Support touch hold for continuous movement (down key)
            if (btnId === "btn-down") {
              var holdInterval = null;
              btn.addEventListener("touchstart", function(e) {
                e.preventDefault();
                triggerKey();
                holdInterval = setInterval(triggerKey, 100);
              });
              btn.addEventListener("touchend", function() {
                if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
              });
              btn.addEventListener("touchcancel", function() {
                if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
              });
            }
          });

          console.log("[Blockrain] touch controls initialized");
        }
      })().catch(function(error) { console.log("[Blockrain] load failed:", error); });
    </script>
  `;
}
