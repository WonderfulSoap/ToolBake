---
sidebar_position: 30
---

# Special UI Component: RawHtmlInput

:::warning
Using the `RawHtmlInput` component means you can render absolutely anything on the page, including but not limited to:

- Arbitrary HTML
- Loading arbitrary CSS
- Loading arbitrary JavaScript
- And more

Therefore, only use this component with content you fully trust. Otherwise, it may lead to security issues.
:::


[LabelInput](label-doc.md) gives users the ability to display arbitrary HTML, but it has some limitations. For example, it does not allow executing `<script>`, which means you cannot insert HTML that loads a JS script from the network like this:

```html
<script src="https://example.com/script.js"></script>
<link rel="stylesheet" href="https://example.com/style.css">
<p>hello world</p>
```


If you want to import third-party JS packages via `<script>` to implement more complex HTML interactive features, you can use the `RawHtmlInput` component. It allows you to insert arbitrary HTML, including `<script>` tags.


The usage of `RawHtmlInput` is exactly the same as the advanced usage in [label-doc.md](label-doc.md). The only difference is that it no longer supports returning a plain string result — it can only return an object in the following format:

```json
{
  "innerHtml": "<p>hello world</p>",
  "afterHook": (container) => {}
}
```


## `<script>` Loading Order

Because `RawHtmlInput` inserts HTML into the DOM via `createContextualFragment()`, if your HTML contains multiple `<script>` tags, their execution order is not guaranteed.

The workaround is:

1. Ensure the imported `<script>` tags have no dependencies on each other.
2. Or rewrite the `<script>` JS loading in the following form:


```html
<script>
  (async function() {
    await loadScript("https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js");
    await loadScript("https://cdn.jsdelivr.net/npm/blockrain@0.2.0/dist/blockrain.jquery.min.js");
    // init after deps ready
  })().catch(function(error) { console.log("[loadScript] failed:", error); });

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
</script>
```

## Example
The [Tetris](https://toolbake.com/t/official-blockrain-tetris) official tool is built using RawHtmlInput. It dynamically loads the JS and CSS from [blockrain.js](https://github.com/Aerolab/blockrain.js) to implement an online Tetris game.
