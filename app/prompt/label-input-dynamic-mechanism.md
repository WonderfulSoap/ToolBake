# LabelInput Dynamic Interaction Mechanism Guide

LabelInput is a special display component that, in addition to static HTML rendering, supports dynamic interaction through the `afterHook` function and state persistence between handler executions via `data-*` attributes.

---

## Output Value Types

LabelInput supports two output value formats:

### Plain String (Static Display)

```javascript
return {
  "my-label": "<div class='text-sm'>Hello World</div>"
};
```

### Structured Object (Dynamic Interaction)

```typescript
interface LabelInputScriptValue {
  innerHtml: string;                           // HTML content to render
  afterHook?: (container: HTMLElement) => void; // Callback executed after HTML is inserted into the DOM
  data?: Record<string, Record<string, unknown>>; // data-* snapshot read by the handler (usually no need to set manually)
}
```

---

## afterHook Event Binding Mechanism

### Execution Timing

- `afterHook` is executed immediately **after** the HTML is inserted into the DOM
- It re-executes every time the LabelInput value changes
- Execution context: the `container` parameter in `afterHook(container)` is the parent container DOM element wrapping the HTML

### Why afterHook Is Needed

HTML inline events (such as `onclick="..."`, `onchange="..."`) **are not automatically bound**. Event listeners must be manually added in `afterHook`.

### Typical Usage

```javascript
function buildInteractiveLabel(count) {
  const innerHtml = `
    <div id="container" data-count="${count}">
      <span id="display">${count}</span>
      <button id="inc-btn">+</button>
      <button id="dec-btn">-</button>
    </div>
  `;

  const afterHook = (container) => {
    const incBtn = container.querySelector("#inc-btn");
    const decBtn = container.querySelector("#dec-btn");
    const display = container.querySelector("#display");
    const wrapper = container.querySelector("#container");

    if (!incBtn || !decBtn || !display || !wrapper) return;

    incBtn.addEventListener("click", () => {
      const current = Number(wrapper.dataset.count || "0");
      const next = current + 1;
      wrapper.dataset.count = String(next);  // Update data-* attribute
      display.textContent = String(next);    // Update display
    });

    decBtn.addEventListener("click", () => {
      const current = Number(wrapper.dataset.count || "0");
      const next = Math.max(0, current - 1);
      wrapper.dataset.count = String(next);
      display.textContent = String(next);
    });
  };

  return { innerHtml, afterHook };
}
```

---

## data-* Attribute Collection Mechanism

### Collection Rules

- When the handler executes, LabelInput automatically collects the `data-*` values of all elements with an `id` attribute within the container
- The collected result structure: `{ elementId: { dataAttrName: value, ... }, ... }`
- **Only `data-*` attributes on elements with an `id` are collected**

### Reading data-* in the Handler

```javascript
async function handler(inputWidgets, changedWidgetIds, callback) {
  // inputWidgets["label-id"] contains the collected data-*
  const labelState = inputWidgets["counter-label"];

  // Example labelState structure:
  // {
  //   innerHtml: "...",
  //   afterHook: function...,
  //   data: {
  //     "counter-container": {
  //       "data-count": "5",
  //       "data-name": "example"
  //     }
  //   }
  // }

  // Read a specific element's data-* value
  const count = Number(labelState?.data?.["counter-container"]?.["data-count"] || "0");

  // Use the retrieved value for further processing...
}
```

### data-* Naming Convention

When reading in the handler, `data-count` corresponds to the key `"data-count"` (the full attribute name is preserved, including the `data-` prefix).

---

## State Persistence Flow

The interaction cycle of LabelInput is as follows:

```
┌────────────────────────────────────────────────────────────────┐
│  1. Handler executes, generates { innerHtml, afterHook }       │
│                          ↓                                     │
│  2. LabelInput renders innerHtml into the DOM                  │
│                          ↓                                     │
│  3. afterHook executes, binds event listeners                  │
│                          ↓                                     │
│  4. User interacts, modifies DOM data-* and display content    │
│                          ↓                                     │
│  5. Another input triggers handler re-execution                │
│                          ↓                                     │
│  6. Handler reads LabelInput's data-* snapshot                 │
│                          ↓                                     │
│  7. Handler generates new { innerHtml, afterHook } with state  │
│                          ↓                                     │
│  8. Back to step 2, UI state is preserved                      │
└────────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Handler overwrites Label HTML**: Each handler execution re-renders the Label content
2. **State persistence requires write-back**: The handler must read state from `data-*` and write the state back into `data-*` and display content when generating new HTML
3. **DOM changes inside Label do not trigger the handler**: Only changes in other input components trigger the handler

---

## Complete Example: Counter

### uiWidgets.json Configuration

```json
[
  [
    {
      "id": "counter-label",
      "type": "LabelInput",
      "title": "Interactive Counter",
      "mode": "output",
      "props": {
        "content": "<div class='text-sm text-muted-foreground'>Loading...</div>",
        "autoHeight": true
      }
    }
  ],
  [
    {
      "id": "reset-btn",
      "type": "ButtonInput",
      "title": "",
      "mode": "input",
      "props": {
        "label": "Count",
        "variant": "outline"
      }
    }
  ]
]
```

### handler.js Implementation

```javascript
async function handler(inputWidgets, changedWidgetIds, callback) {
  // 1. Read the current count from the label's data-*
  const labelState = inputWidgets["counter-label"];
  let count = readCountFromState(labelState);

  // 2. Handle reset button click
  if (changedWidgetIds === "reset-btn") {
    count = 0;
  }

  // 3. Return the updated label (with state)
  return {
    "counter-label": buildCounterLabel(count),
  };
}

/**
 * Read the count from the label's collected data-*
 */
function readCountFromState(value) {
  if (!value || typeof value !== "object") return 0;
  const data = value.data;
  if (!data || typeof data !== "object") return 0;

  const containerData = data["counter-container"];
  if (!containerData) return 0;

  const raw = containerData["data-count"];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build an interactive counter Label
 */
function buildCounterLabel(count) {
  const safeCount = Number.isFinite(count) ? count : 0;

  const innerHtml = `
    <div id="counter-container" data-count="${safeCount}" class="space-y-3">
      <div class="flex items-center gap-4">
        <span class="text-2xl font-bold" id="count-display">${safeCount}</span>
        <div class="flex gap-2">
          <button id="dec-btn" class="rounded-md bg-muted px-3 py-1 text-sm hover:bg-muted/80">-</button>
          <button id="inc-btn" class="rounded-md bg-primary text-primary-foreground px-3 py-1 text-sm hover:bg-primary/90">+</button>
        </div>
      </div>
      <div class="text-xs text-muted-foreground">
        Click buttons to change count. State persists via <code>data-*</code> attributes.
      </div>
    </div>
  `;

  const afterHook = (container) => {
    const incBtn = container.querySelector("#inc-btn");
    const decBtn = container.querySelector("#dec-btn");
    const countDisplay = container.querySelector("#count-display");
    const counterContainer = container.querySelector("#counter-container");

    if (!incBtn || !decBtn || !countDisplay || !counterContainer) return;

    const updateCount = (delta) => {
      const current = Number(counterContainer.dataset.count || "0");
      const next = Math.max(0, current + delta);
      counterContainer.dataset.count = String(next);  // Update data-*
      countDisplay.textContent = String(next);        // Update display
    };

    incBtn.addEventListener("click", () => updateCount(1));
    decBtn.addEventListener("click", () => updateCount(-1));
  };

  return { innerHtml, afterHook };
}
```

---

## Notes

### DOM Queries in afterHook

- Use `container.querySelector()` instead of `document.querySelector()`
- Ensure queried element IDs are unique within the current Label

### Event Listener Cleanup

- In the current implementation, the DOM is rebuilt every time the value changes, and old event listeners are automatically destroyed along with the DOM
- If using global listeners such as `document.addEventListener`, manual cleanup is required

### Avoid Direct Manipulation of External DOM

- afterHook should only manipulate DOM elements inside `container`
- Do not modify elements outside of `container`

### Performance Considerations

- afterHook executes every time the value changes
- Avoid performing heavy operations in afterHook
- For complex initializations (such as chart libraries), consider using conditional checks to avoid repeated initialization

---

## Difference from the script Field (Legacy)

Historical versions used the `script` field (a string) to execute scripts via `new Function`. The current version has been replaced with `afterHook` (a function), which passes a function reference directly, making it more secure and easier to debug.

---

## Debugging Tips

### Inspect Collected data-*

Add logging at the beginning of the handler:

```javascript
console.log("[handler] labelState:", JSON.stringify(inputWidgets["my-label"], null, 2));
```

### Check afterHook Execution

Add logging inside afterHook:

```javascript
const afterHook = (container) => {
  console.log("[afterHook] container:", container);
  console.log("[afterHook] found elements:", {
    incBtn: container.querySelector("#inc-btn"),
    decBtn: container.querySelector("#dec-btn"),
  });
  // ...
};
```

### Common Issues Troubleshooting

| Symptom | Possible Cause |
|---------|---------------|
| Button click has no response | Event binding failed in afterHook; check element selectors |
| State lost (reverts to initial value) | Handler did not correctly read data-* or did not write back to innerHtml |
| data-* reads as empty | Element is missing the `id` attribute, or data-* attribute name is misspelled |
| afterHook not executed | Returned a plain string instead of an object `{ innerHtml, afterHook }` |
