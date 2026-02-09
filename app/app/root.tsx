import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  type LoaderFunctionArgs,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { AuthProvider } from "~/contexts/auth-context";
import type { ThemeColor } from "~/contexts/theme-context";

export type RootLoaderData = Awaited<ReturnType<typeof loader>>;

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie");
  console.log(`cookieHeader: ${cookieHeader}`);

  // Normalize loader data shape so the client can read it predictably.
  const cookies = Object.fromEntries(cookieHeader?.split("; ").map(c => c.split("=")) || []);

  return { cookieLoader: cookies };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel        : "preconnect",
    href       : "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel : "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  // Serve icons from /assets after moving public root files.
  { rel: "icon", type: "image/svg+xml", href: "/assets/logo.svg" },
  { rel: "icon", href: "/assets/favicon.ico", sizes: "any" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "apple-touch-icon", href: "/assets/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { cookieLoader } = useLoaderData<RootLoaderData>();
  // Read theme from cookies only in dev to keep production HTML deterministic.
  const themeClass = cookieLoader?.["toolbake-ui-theme"] ?? "light";
  const themeColor = (cookieLoader?.["toolbake-ui-theme-color-option"] ?? "indigo") as ThemeColor;

  return (
    <html lang="en" className={`${themeClass} theme-color-${themeColor}`} data-theme={themeClass} data-theme-color={themeColor}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4f46e5" />
        {/* Runtime config anchor: replace this tag with <script id="__SSR_CONFIG__">window.__RUNTIME_CONFIG__={ githubClientId: "your-client-id" };</script>. */}
        {import.meta.env.DEV ? <script src="/ssr-config.js"></script> : null}
        <script id="__SSR_CONFIG__" data-runtime-config-anchor="true"></script>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
