import { cn } from "~/lib/utils";

export function stripHtmlToText(input: string) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return input.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(input, "text/html");
  return doc.body.textContent ?? "";
}

export function SafeHtml(props: { html: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary/80 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-primary/40 [&_a:focus-visible]:rounded-sm",
        props.className
      )}
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
}

export function SafeHtmlBlock(props: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary/80 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-primary/40 [&_a:focus-visible]:rounded-sm",
        props.className
      )}
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
}
