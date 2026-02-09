import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Copy, LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { useIsGuest, useLogout, useUserInfo } from "~/hooks/use-auth";
import { ErrorHandler } from "~/error/error-checker";

interface UserAvatarProps {
  onOpenLoginDialog    : () => void;
  onOpenProfileSettings: () => void;
  onReportError?       : (source: string, message?: string, error?: unknown) => void;
}

/**
 * User avatar button with popover menu.
 * Displays guest menu (with login option) or user menu (with logout option).
 */
export function UserAvatar({ onOpenLoginDialog, onOpenProfileSettings, onReportError }: UserAvatarProps) {
  const isGuest = useIsGuest();
  const { data: userInfo } = useUserInfo();
  const logoutMutation = useLogout();
  const navigate = useNavigate();

  const [isGuestMenuOpen, setIsGuestMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDebugToolExecutionEnabled, setIsDebugToolExecutionEnabled] = useState(false);
  const [isIdCopied, setIsIdCopied] = useState(false);

  // Prefer name, then mail, then id for display without persisting anything locally.
  const signedInDisplayName = userInfo?.name?.trim() || userInfo?.mail?.trim() || userInfo?.id?.trim() || null;
  const userInitial = (signedInDisplayName?.charAt(0).toUpperCase() || "?") as string;

  function readDebugToolExecutionFlag() {
    try {
      return globalThis?.localStorage?.getItem("YA_DEBUG_TOOL_EXECUTION") === "1";
    } catch {
      return false;
    }
  }

  function setDebugToolExecutionFlag(enabled: boolean) {
    try {
      if (enabled) globalThis?.localStorage?.setItem("YA_DEBUG_TOOL_EXECUTION", "1");
      else globalThis?.localStorage?.removeItem("YA_DEBUG_TOOL_EXECUTION");
      window.dispatchEvent(new Event("ya-debug-tool-execution-changed"));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setIsDebugToolExecutionEnabled(readDebugToolExecutionFlag());
  }, []);

  const handleOpenLogin = useCallback(() => {
    setIsGuestMenuOpen(false);
    onOpenLoginDialog();
  }, [onOpenLoginDialog]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
      setIsUserMenuOpen(false);
      void navigate("/", { replace: true });
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to logout.";
      onReportError?.("auth.logout", message, error);
    }
  }, [logoutMutation, navigate, onReportError]);

  // Copy the user id for support/debug workflows without persisting any state.
  async function handleCopyUserId() {
    const userId = userInfo?.id?.trim();
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setIsIdCopied(true);
      window.setTimeout(() => setIsIdCopied(false), 1600);
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to copy user id.";
      onReportError?.("profile.copy-id", message, error);
    }
  }

  // Jump to the profile settings tab and close the menu to reduce context switching.
  function handleOpenProfileSettings() {
    setIsUserMenuOpen(false);
    onOpenProfileSettings();
  }

  function handleDebugToolExecutionCheckedChange(checked: boolean) {
    setIsDebugToolExecutionEnabled(checked);
    setDebugToolExecutionFlag(checked);
  }

  if (isGuest) {
    return (
      <Popover open={isGuestMenuOpen} onOpenChange={setIsGuestMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center px-2 py-2 rounded-full border border-dashed border-border text-left hover:bg-muted/40 transition-colors"
            aria-label="Guest menu"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
              <UserRound className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Guest Mode</p>
            <p className="text-xs text-muted-foreground">Sign in to sync your workspace and access cloud tools.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/10 px-3 py-2">
            <div className="flex flex-col">
              <label htmlFor="debug-tool-execution-guest" className="text-xs font-semibold text-foreground cursor-pointer">
                Debug Tool Execution
              </label>
              <span className="text-[11px] text-muted-foreground">Enable extra console logs for tool runs.</span>
            </div>
            <Switch id="debug-tool-execution-guest" checked={isDebugToolExecutionEnabled} onCheckedChange={handleDebugToolExecutionCheckedChange} />
          </div>
          <Button className="w-full gap-2" onClick={handleOpenLogin}>
            <LogIn className="h-4 w-4" />
            Login
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center px-2 py-2 rounded-full border border-border text-left hover:bg-muted/40 transition-colors"
          aria-label="Account menu"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center border border-primary/40">
            {userInitial}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Account</p>
          <p className="text-xs text-muted-foreground truncate">{signedInDisplayName ?? "Unknown user"}</p>
          {userInfo?.id && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground/70 truncate">ID: {userInfo.id}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => { void handleCopyUserId(); }}
                aria-label="Copy user id"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {isIdCopied && <p className="text-[11px] text-primary">Copied</p>}
        </div>
        <Button variant="secondary" className="w-full gap-2" onClick={handleOpenProfileSettings}>
          <Settings className="h-4 w-4" />
          Profile Settings
        </Button>
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/10 px-3 py-2">
          <div className="flex flex-col">
            <label htmlFor="debug-tool-execution-user" className="text-xs font-semibold text-foreground cursor-pointer">
              Debug Tool Execution
            </label>
            <span className="text-[11px] text-muted-foreground">Enable extra console logs for tool runs.</span>
          </div>
          <Switch id="debug-tool-execution-user" checked={isDebugToolExecutionEnabled} onCheckedChange={handleDebugToolExecutionCheckedChange} />
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={() => { void handleLogout(); }} disabled={logoutMutation.isPending}>
          <LogOut className="h-4 w-4" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
