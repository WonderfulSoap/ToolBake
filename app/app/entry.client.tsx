import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { registerSW } from "virtual:pwa-register";

// Register service worker for installability and offline shell caching.
registerSW({ immediate: true });

startTransition(() => {
  console.log("[entry.client.tsx] startTransition");
  hydrateRoot(
    document,
    <HydratedRouter />
  );
});
