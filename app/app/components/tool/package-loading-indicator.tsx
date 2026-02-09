import { useState, useImperativeHandle, useRef, type Ref } from "react";
import { cn } from "~/lib/utils";

// Only show loading UI if package loading takes longer than this threshold
const SHOW_DELAY_MS = 1000;
// Minimum time to keep the loading UI visible once shown
const HIDE_DELAY_MS = 3000;

export interface PackageLoadingIndicatorHandle {
  addPackage   : (pkg: string) => void;
  removePackage: (pkg: string) => void;
}

interface PackageLoadingIndicatorProps {
  className?: string;
  ref?      : Ref<PackageLoadingIndicatorHandle>;
}

export function PackageLoadingIndicator({ className, ref }: PackageLoadingIndicatorProps) {
  const [loadingPackages, setLoadingPackages] = useState<Set<string>>(new Set());
  // Track packages that finished loading but still visible during hide delay
  const [completedPackages, setCompletedPackages] = useState<Set<string>>(new Set());
  // Track pending timers for delayed show
  const pendingShowTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track when each package became visible (for minimum display time)
  const shownAtRef = useRef<Map<string, number>>(new Map());

  useImperativeHandle(ref, () => ({
    addPackage: (pkg: string) => {
      // If already showing or pending, skip
      if (pendingShowTimers.current.has(pkg)) return;

      // Delay showing the UI
      const timer = setTimeout(() => {
        pendingShowTimers.current.delete(pkg);
        shownAtRef.current.set(pkg, Date.now());
        setLoadingPackages((prev) => new Set(prev).add(pkg));
      }, SHOW_DELAY_MS);
      pendingShowTimers.current.set(pkg, timer);
    },
    removePackage: (pkg: string) => {
      // If still pending (loaded quickly), just cancel the timer
      const showTimer = pendingShowTimers.current.get(pkg);
      if (showTimer) {
        clearTimeout(showTimer);
        pendingShowTimers.current.delete(pkg);
        return;
      }

      // Mark as completed immediately (for UI state)
      setCompletedPackages((prev) => new Set(prev).add(pkg));

      // Calculate how long it's been visible
      const shownAt = shownAtRef.current.get(pkg) ?? 0;
      const elapsed = Date.now() - shownAt;
      const hideDelay = Math.max(0, HIDE_DELAY_MS - elapsed);

      const doRemove = () => {
        shownAtRef.current.delete(pkg);
        setLoadingPackages((prev) => {
          const next = new Set(prev);
          next.delete(pkg);
          return next;
        });
        setCompletedPackages((prev) => {
          const next = new Set(prev);
          next.delete(pkg);
          return next;
        });
      };

      if (hideDelay > 0) setTimeout(doRemove, hideDelay);
      else doRemove();
    },
  }), []);

  if (loadingPackages.size === 0) return null;

  const packages = Array.from(loadingPackages);
  const allCompleted = packages.every((pkg) => completedPackages.has(pkg));

  return (
    <div className={cn("rounded-lg border border-border bg-muted/40 px-4 py-3", className)}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        {allCompleted ? "Loaded" : `Loading ${packages.length > 1 ? "packages" : "package"}`}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        {packages.map((pkg) => {
          const isCompleted = completedPackages.has(pkg);
          return (
            <span key={pkg} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", isCompleted ? "bg-green-500" : "bg-primary animate-pulse")} />
              {pkg}
            </span>
          );
        })}
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-muted/70 overflow-hidden">
        <div className={cn("h-full transition-all duration-300", allCompleted ? "w-full bg-green-500" : "w-2/3 bg-primary/70 animate-pulse")} />
      </div>
    </div>
  );
}
