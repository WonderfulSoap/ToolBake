import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { Code, Zap, Lock, Sparkles, Bot, Clapperboard, ChevronDown, LayoutTemplate, PackagePlus } from "lucide-react";
import { officialToolsMeta, type ToolMeta } from "~/tools/official-tools-meta";
import { Button } from "~/components/ui/button";
import { Logo } from "~/components/header/logo";

/**
 * Meta function for SEO - generates static meta tags at build time.
 */
export const meta: MetaFunction = () => {
  const title = "ToolBake - Developer Tool Platform";
  const description = "A customizable developer tool platform. Build, share, and use powerful tools for encoding, conversion, formatting, and more. All tools run locally in your browser.";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

/** Feature card data for the hero section */
const features = [
  { icon: Code, title: "Highly Customizable", description: "Create custom tools with JavaScript and define ui with json" },
  { icon: Clapperboard, title: "Feature-Rich", description: "A rich toolbox for video, audio, image processing, and even game-related workflows" },
  { icon: Bot, title: "AI Tool Generation", description: "Describe your idea and let AI generate a runnable tool scaffold for you" },
  { icon: LayoutTemplate, title: "Simple UI Platform", description: "Use ToolBake as a lightweight UI platform to build and run interactive mini experiences" },
  { icon: PackagePlus, title: "Highly Extensible", description: "Load any required packages on demand to extend capabilities for your own workflows" },
  { icon: Zap, title: "Instant", description: "All tools run locally in your browser with zero server round-trips" },
  { icon: Lock, title: "Private", description: "Your data never leaves your device - complete privacy by design" },
  { icon: Sparkles, title: "Modern", description: "Built with modern web technologies for the best developer experience" },
];

/**
 * Group tools by namespace, then by category from metadata.
 * Empty namespace/category fall back to "Unassigned"/"General".
 */
function groupToolsByNamespaceAndCategory(tools: ToolMeta[]): Map<string, Map<string, ToolMeta[]>> {
  const result = new Map<string, Map<string, ToolMeta[]>>();
  for (const tool of tools) {
    const namespace = tool.namespace?.trim() || "Unassigned";
    const category = tool.category?.trim() || "General";
    let namespaceGroups = result.get(namespace);
    if (!namespaceGroups) {
      namespaceGroups = new Map<string, ToolMeta[]>();
      result.set(namespace, namespaceGroups);
    }
    const categoryTools = namespaceGroups.get(category);
    if (categoryTools) categoryTools.push(tool);
    else namespaceGroups.set(category, [tool]);
  }
  return result;
}

/** Strip HTML tags from description for display */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Home page component - introduces ToolBake and displays official tools.
 * Supports SSG by using officialToolsMeta for tool data.
 */
export default function HomePage() {
  const toolList = Object.values(officialToolsMeta);
  const groupedTools = groupToolsByNamespaceAndCategory(toolList);

  /** Smoothly scroll to the official tools section in the same page. */
  function scrollToOfficialTools() {
    document.getElementById("official-tools-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="h-full w-full overflow-auto bg-background">
      {/* Hero Section - full width background */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-6 py-16 md:py-24 lg:px-8">
          <div className="flex flex-col items-center text-center">
            {/* Logo and Title */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center text-primary">
                <Logo className="h-14 w-14" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">ToolBake</h1>
            </div>

            {/* Tagline */}
            <p className="mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
              A customizable developer tool platform. Build, share, and use powerful tools — all running locally in your browser.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center gap-1.5">
              <Button asChild size="lg" className="bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/35">
                <Link to="/t/new">Create Your Own Tool</Link>
              </Button>
              <Button type="button" variant="link" className="h-auto px-1 text-sm text-muted-foreground hover:text-primary" onClick={scrollToOfficialTools}>
                <span className="flex flex-col items-center leading-tight">
                  <span>Explore Official Tools</span>
                  <ChevronDown className="mt-0.5 h-3.5 w-3.5" />
                </span>
              </Button>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="group rounded-xl bg-card/60 p-5 shadow-sm transition-all hover:bg-card hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tool Categories Section - full width with inner constraint */}
      <section id="official-tools-section" className="w-full bg-muted/20 py-12">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold md:text-3xl">{toolList.length} Official Tools</h2>
            <p className="text-muted-foreground">Ready to use, no setup required</p>
          </div>

          <div className="space-y-10">
            {Array.from(groupedTools.entries()).map(([namespace, categoryGroups]) => {
              const namespaceToolCount = Array.from(categoryGroups.values()).reduce((sum, tools) => sum + tools.length, 0);
              return (
                <div key={namespace}>
                  {/* Namespace Header */}
                  <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{namespace}</h3>
                    <span className="ml-auto text-xs text-muted-foreground">{namespaceToolCount} tools</span>
                  </div>

                  {/* Category Groups under namespace */}
                  <div className="space-y-6 pl-8 md:pl-10">
                    {Array.from(categoryGroups.entries()).map(([category, tools]) => (
                      <div key={`${namespace}-${category}`}>
                        <div className="mb-3 flex items-baseline gap-2">
                          <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
                          <span className="text-xs text-muted-foreground/80">{tools.length}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {tools.map((tool) => (
                            <Link
                              key={tool.id}
                              to={`/t/${tool.id}`}
                              className="group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/70 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
                            >
                              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                              <h5 className="mb-1.5 font-semibold tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary">{tool.name}</h5>
                              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{stripHtml(tool.description)}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer - full width */}
      <footer className="w-full border-t bg-muted/30 py-8">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 flex items-center justify-between text-sm text-muted-foreground">
          <p>ToolBake - Developer Tool Platform</p>
          <div className="flex items-center gap-1 text-xs">
            <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <span>&middot;</span>
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
