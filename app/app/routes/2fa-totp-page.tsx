import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useToastContext } from "~/contexts/toast-context";
import { useLoginWith2Fa } from "~/hooks/use-auth";
import { ErrorHandler } from "~/error/error-checker";
import { OtpInput } from "~/components/ui/otp-input";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { globalDI } from "~/di/global-di";

type PageStatus = "input" | "pending" | "success" | "error";
type RecoveryStatus = "idle" | "pending" | "success" | "error";

/**
 * 2FA TOTP verification page.
 * Displayed when user login requires TOTP code verification.
 * Token is passed via query parameter (?token=xxx).
 */
export default function TwoFaTotpPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reportError, reportNotice } = useToastContext();
  const loginWith2FaMutation = useLoginWith2Fa();

  const token = useMemo(() => (searchParams.get("token") ?? "").trim(), [searchParams]);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<PageStatus>("input");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("idle");
  const [recoveryError, setRecoveryError] = useState<string>();
  const hasRedirectedRef = useRef(false);

  // Redirect to home if no token provided
  useEffect(() => {
    if (!token && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      void navigate("/", { replace: true });
    }
  }, [token, navigate]);

  const handleVerify = useCallback(async (verifyCode: string) => {
    if (!token || status === "pending" || status === "success") return;
    setStatus("pending");
    setErrorMessage(undefined);

    try {
      await loginWith2FaMutation.mutateAsync({ token, code: verifyCode });
      setStatus("success");
      reportNotice("auth.2fa.totp", "Welcome back!");
      window.setTimeout(() => void navigate("/", { replace: true }), 0);
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to verify 2FA code.";
      setErrorMessage(message);
      setStatus("error");
      setCode(""); // Clear code on error to allow retry
      reportError("auth.2fa.totp", message, error);
    }
  }, [token, status, loginWith2FaMutation, navigate, reportError, reportNotice]);

  const handleRecovery = useCallback(async () => {
    if (!token || recoveryStatus === "pending" || recoveryStatus === "success") return;
    const trimmedCode = recoveryCode.trim();
    if (!trimmedCode) {
      setRecoveryError("Recovery code is required.");
      return;
    }
    // Handle recovery flow when user loses access to the authenticator device.
    setRecoveryStatus("pending");
    setRecoveryError(undefined);
    try {
      await globalDI.authHelper.recover2Fa(token, trimmedCode);
      setRecoveryStatus("success");
      reportNotice("auth.2fa.recovery", "2FA removed. You can log in again.");
    } catch (error) {
      ErrorHandler.processError(error);
      const message = ErrorHandler.isInvalidRecoveryCode(error) ? "Recovery code is incorrect." : "Failed to recover 2FA.";
      setRecoveryError(message);
      setRecoveryStatus("error");
      reportError("auth.2fa.recovery", message, error);
    }
  }, [token, recoveryStatus, recoveryCode, navigate, reportError, reportNotice]);

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-muted/30 p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">2FA Verification</p>
          <p className="mt-2 text-xs text-muted-foreground">Missing verification token. Redirecting...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-[calc(100vh-56px)] w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-muted/30 p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">2FA Verification</p>
          <p className="mt-2 text-xs text-muted-foreground">Verified successfully. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] w-full items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-muted/30 p-6 shadow-sm">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Two-Factor Authentication</p>
          <p className="mt-2 text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        </div>
        <div className="mt-6 space-y-4">
          <OtpInput
            value={code}
            onChange={setCode}
            length={6}
            disabled={status === "pending"}
            autoFocus
            onComplete={(v) => { void handleVerify(v); }}
          />
          {status === "pending" && (
            <p className="text-center text-xs text-muted-foreground">Verifying...</p>
          )}
          {errorMessage && (
            <p className="text-center text-xs text-destructive">{errorMessage}</p>
          )}
          <div className="pt-2 text-center text-xs text-muted-foreground">
            <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={() => setIsRecoveryOpen((prev) => !prev)}>
              Lost access to your authenticator?
            </button>
          </div>
          {isRecoveryOpen && (
            <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
              {recoveryStatus === "success" ? (
                <>
                  <p className="text-xs text-muted-foreground">2FA has been removed. You can now log in again.</p>
                  <Button type="button" className="w-full" onClick={() => void navigate("/", { replace: true })}>
                    Back to home
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Enter your recovery code to remove 2FA and log in again.</p>
                  <Input
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    placeholder="Recovery code"
                    disabled={recoveryStatus === "pending"}
                  />
                  {recoveryError && (
                    <p className="text-center text-xs text-destructive">{recoveryError}</p>
                  )}
                  {recoveryStatus === "pending" && (
                    <p className="text-center text-xs text-muted-foreground">Recovering...</p>
                  )}
                  <Button type="button" className="w-full" disabled={recoveryStatus === "pending"} onClick={() => void handleRecovery()}>
                    Recover with code
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
