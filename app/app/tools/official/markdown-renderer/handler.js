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
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const MarkdownIt = await requirePackage("markdown-it");
  const source = inputWidgets["input-markdown"] ?? "";
  const allowHtml = Boolean(inputWidgets["allow-html"]);
  const linkify = Boolean(inputWidgets["linkify"]);
  const typographer = Boolean(inputWidgets["typographer"]);
  const breaks = Boolean(inputWidgets["breaks"]);
  const md = new MarkdownIt({ html: allowHtml, linkify, typographer, breaks });
  const rendered = md.render(source);

  return {
    "preview-html": buildPreviewHtml(rendered),
    "output-html" : rendered,
  };
}

function buildPreviewHtml(html) {
  if (!html.trim()) {
    return "<div class='text-sm leading-relaxed text-muted-foreground'>Rendered preview will appear here.</div>";
  }
  return "<div class='text-sm leading-relaxed text-foreground [&>*+*]:mt-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono [&_pre]:rounded-md [&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:overflow-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_table]:my-2 [&_th]:border [&_th]:border-muted [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-muted [&_td]:px-2 [&_td]:py-1 [&_tbody_tr:nth-child(odd)]:bg-muted/20'>" + html + "</div>";
}
