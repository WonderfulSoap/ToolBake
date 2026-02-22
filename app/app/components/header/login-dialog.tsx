import { useCallback, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Github, KeyRound } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useLogin, useLoginWithPasskey, useRegister } from "~/hooks/use-auth";
import { ErrorHandler } from "~/error/error-checker";
import { buildGithubAuthorizeUrl, buildGoogleAuthorizeUrl, generateSsoStateId, getSsoStateStorageKey } from "~/lib/sso";
import { globalDI } from "~/di/global-di";
import { base64UrlToArrayBuffer } from "~/lib/utils";
import type { PasskeyLoginRequest } from "~/data/interface/i-auth-repository";

interface LoginDialogProps {
  open           : boolean;
  onOpenChange   : (open: boolean) => void;
  onLoginSuccess?: () => void;
  onReportError? : (source: string, message?: string, error?: unknown) => void;
  onReportNotice?: (source: string, message?: string) => void;
}

const registerUsernameMinLength = 3;
const registerUsernameMaxLength = 32;
const registerPasswordMinLength = 8;
const registerPasswordMaxLength = 32;

/** Read GitHub SSO config from runtime config injected by the server. */
function readGithubSsoConfig() {
  const config = (globalThis as any)?.__SSR_CONFIG__ as {
    sso?: { github?: { client_id?: string; redirect_uri?: string } };
  } | undefined;
  const githubConfig = config?.sso?.github;
  if (!githubConfig) return null;
  return { clientId: githubConfig.client_id ?? "", redirectUri: githubConfig.redirect_uri ?? "" };
}

/** Read Google SSO config from runtime config injected by the server. */
function readGoogleSsoConfig() {
  const config = (globalThis as any)?.__SSR_CONFIG__ as {
    sso?: { google?: { client_id?: string; redirect_uri?: string } };
  } | undefined;
  const googleConfig = config?.sso?.google;
  if (!googleConfig) return null;
  return { clientId: googleConfig.client_id ?? "", redirectUri: googleConfig.redirect_uri ?? "" };
}

/** Read password_login flag from runtime config. Returns true if not explicitly set to false. */
function isPasswordLoginEnabled() {
  const config = (globalThis as any)?.__SSR_CONFIG__ as { password_login?: boolean } | undefined;
  console.log(`SSR Config: ${JSON.stringify(config)}`);
  return config?.password_login === true;
}

/** Read register enable flag from runtime config. Defaults to true when omitted. */
function isRegisterEnabled() {
  const config = (globalThis as any)?.__SSR_CONFIG__ as { enable_register?: boolean; enableRegister?: boolean } | undefined;
  console.log(`SSR Config: ${JSON.stringify(config)}`);
  return config?.enable_register === true;
}

/** Validate register username length and return error message when invalid. */
function getRegisterUsernameLengthError(username: string): string | undefined {
  const length = username.trim().length;
  if (length === 0) return `Username must be ${registerUsernameMinLength}-${registerUsernameMaxLength} characters.`;
  if (length < registerUsernameMinLength) return `Username must be at least ${registerUsernameMinLength} characters.`;
  if (length > registerUsernameMaxLength) return `Username must be at most ${registerUsernameMaxLength} characters.`;
  return undefined;
}

/** Validate register password length and return error message when invalid. */
function getRegisterPasswordLengthError(password: string): string | undefined {
  const length = password.length;
  if (length === 0) return `Password must be ${registerPasswordMinLength}-${registerPasswordMaxLength} characters.`;
  if (length < registerPasswordMinLength) return `Password must be at least ${registerPasswordMinLength} characters.`;
  if (length > registerPasswordMaxLength) return `Password must be at most ${registerPasswordMaxLength} characters.`;
  return undefined;
}

/** Convert ArrayBuffer to base64url string for WebAuthn credential encoding. */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build passkey login request payload from WebAuthn credential assertion. */
function buildPasskeyLoginRequest(credential: PublicKeyCredential): PasskeyLoginRequest {
  const response = credential.response as AuthenticatorAssertionResponse;
  if (!response?.authenticatorData || !response.clientDataJSON || !response.signature) {
    throw new Error("Invalid passkey assertion response.");
  }
  return {
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults : (credential.getClientExtensionResults?.() ?? undefined) as Record<string, unknown> | undefined,
    id                     : credential.id,
    rawId                  : arrayBufferToBase64Url(credential.rawId),
    response               : {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON   : arrayBufferToBase64Url(response.clientDataJSON),
      signature        : arrayBufferToBase64Url(response.signature),
      userHandle       : response.userHandle ? arrayBufferToBase64Url(response.userHandle) : undefined,
    },
    type: credential.type,
  };
}

/**
 * Login dialog component supporting password login and SSO (GitHub/Google).
 * Reads SSO configuration from runtime config injected by the server.
 */
export function LoginDialog({ open, onOpenChange, onLoginSuccess, onReportError, onReportNotice }: LoginDialogProps) {
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const passkeyLoginMutation = useLoginWithPasskey();
  const navigate = useNavigate();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string>();
  const [ssoLoginError, setSsoLoginError] = useState<string>();
  /** Tracks which SSO provider is currently in loading state (null = none). */
  const [ssoLoginPendingProvider, setSsoLoginPendingProvider] = useState<"github" | "google" | null>(null);
  const [passkeyLoginPending, setPasskeyLoginPending] = useState(false);
  const [passkeyLoginError, setPasskeyLoginError] = useState<string>();
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState<string>();

  const githubSsoConfig = readGithubSsoConfig();
  const googleSsoConfig = readGoogleSsoConfig();
  const canUseGithubSso = (githubSsoConfig?.clientId?.trim() || "").length > 0;
  const canUseGoogleSso = (googleSsoConfig?.clientId?.trim() || "").length > 0;
  const passwordLoginEnabled = isPasswordLoginEnabled();
  const registerEnabled = isRegisterEnabled();
  const canSubmitLogin = loginUsername.trim().length > 0 && loginPassword.trim().length > 0 && !loginMutation.isPending;
  const canOpenRegisterDialog = passwordLoginEnabled && registerEnabled;
  const registerUsernameLengthError = getRegisterUsernameLengthError(registerUsername);
  const registerPasswordLengthError = getRegisterPasswordLengthError(registerPassword);
  const registerLengthError = registerUsernameLengthError || registerPasswordLengthError;
  const canSubmitRegister = !registerLengthError && !registerMutation.isPending;

  const handleDialogOpenChange = useCallback((nextState: boolean) => {
    onOpenChange(nextState);
    if (!nextState) {
      setLoginError(undefined);
      setSsoLoginError(undefined);
      setPasskeyLoginError(undefined);
      setLoginUsername("");
      setLoginPassword("");
      setRegisterDialogOpenState(false);
    }
  }, [onOpenChange]);

  /** Reset register dialog form state to keep each open interaction clean. */
  function resetRegisterDialogForm() {
    setRegisterUsername("");
    setRegisterPassword("");
    setRegisterError(undefined);
  }

  /** Set register dialog open state and clear form when closing. */
  function setRegisterDialogOpenState(nextState: boolean) {
    setIsRegisterDialogOpen(nextState);
    if (!nextState) resetRegisterDialogForm();
  }

  const handleLoginSubmit = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmitLogin) return;
    setLoginError(undefined);
    const normalizedUsername = loginUsername.trim();
    try {
      await loginMutation.mutateAsync({ username: normalizedUsername, password: loginPassword });
      onOpenChange(false);
      setLoginUsername("");
      setLoginPassword("");
      void navigate("/", { replace: true });
      onReportNotice?.("auth.login", `Welcome back${normalizedUsername ? `, ${normalizedUsername}` : ""}!`);
      onLoginSuccess?.();
    } catch (error) {
      ErrorHandler.processError(error);
      if (ErrorHandler.isInvalidCredentials(error)) {
        setLoginError("Invalid username or password.");
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to login.";
      onReportError?.("auth.login", message, error);
    }
  }, [canSubmitLogin, loginMutation, navigate, onOpenChange, onReportNotice, onReportError, onLoginSuccess, loginPassword, loginUsername]);

  const handleRegisterSubmit = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmitRegister) return;
    setRegisterError(undefined);
    const normalizedUsername = registerUsername.trim();
    try {
      await registerMutation.mutateAsync({ username: normalizedUsername, password: registerPassword });
      setRegisterDialogOpenState(false);
      onOpenChange(true);
      onReportNotice?.("auth.register", `Account created${normalizedUsername ? `: ${normalizedUsername}` : ""}. Please login.`);
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to register.";
      setRegisterError(message);
      onReportError?.("auth.register", message, error);
    }
  }, [canSubmitRegister, onOpenChange, onReportError, onReportNotice, registerMutation, registerPassword, registerUsername]);

  /** Open register dialog and close login dialog to keep auth actions separated. */
  function handleOpenRegisterDialog() {
    if (!canOpenRegisterDialog) return;
    setRegisterDialogOpenState(true);
    onOpenChange(false);
  }

  /** Unified SSO login handler for GitHub and Google. */
  function handleSsoLoginClick(provider: "github" | "google") {
    const providerConfig = { github: { config: githubSsoConfig, canUse: canUseGithubSso, buildUrl: buildGithubAuthorizeUrl }, google: { config: googleSsoConfig, canUse: canUseGoogleSso, buildUrl: buildGoogleAuthorizeUrl } }[provider];
    if (!providerConfig.canUse) return;
    setSsoLoginPendingProvider(provider);
    setSsoLoginError(undefined);
    try {
      const clientId = providerConfig.config?.clientId?.trim() || "";
      const redirectUri = providerConfig.config?.redirectUri?.trim() || "";
      const state = generateSsoStateId();
      globalThis?.localStorage?.setItem(getSsoStateStorageKey(provider), state);
      const authorizeUrl = providerConfig.buildUrl(clientId, redirectUri, state);
      window.location.assign(authorizeUrl);
    } catch (error) {
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      const message = error instanceof Error ? error.message : `Failed to start ${providerName} SSO.`;
      setSsoLoginError(message);
      onReportError?.(`auth.sso.${provider}`, message, error);
      setSsoLoginPendingProvider(null);
    }
  }

  async function handlePasskeyLoginClick() {
    if (passkeyLoginPending) return;
    setPasskeyLoginPending(true);
    setPasskeyLoginError(undefined);
    try {
      // Step 1: Get login challenge from server
      const challenge = await globalDI.authHelper.getPasskeyLoginChallenge();
      console.log("[Passkey Login] Challenge received:", challenge);

      // Step 2: Convert challenge to WebAuthn format and call navigator.credentials.get()
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge       : base64UrlToArrayBuffer(challenge.challenge),
        rpId            : challenge.rpId,
        timeout         : challenge.timeout,
        userVerification: (challenge.userVerification || "preferred") as UserVerificationRequirement,
        allowCredentials: challenge.allowCredentials?.map((cred) => ({
          type      : cred.type as PublicKeyCredentialType,
          id        : base64UrlToArrayBuffer(cred.id),
          transports: cred.transports as AuthenticatorTransport[] | undefined,
        })),
      };

      const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });
      if (!credential) throw new Error("Failed to get passkey credential from authenticator.");
      console.log("[Passkey Login] Credential received:", credential);

      // Step 3: Send credential to server for verification and get tokens
      const payload = buildPasskeyLoginRequest(credential as PublicKeyCredential);
      await passkeyLoginMutation.mutateAsync(payload);

      // Step 4: Login success - close dialog and navigate
      onOpenChange(false);
      void navigate("/", { replace: true });
      onReportNotice?.("auth.passkey.login", "Welcome back!");
      onLoginSuccess?.();
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to login with passkey.";
      setPasskeyLoginError(message);
      onReportError?.("auth.passkey.login", message, error);
    } finally {
      setPasskeyLoginPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login to your account</DialogTitle>
            <DialogDescription>{registerEnabled ? "Enter your credentials to switch from guest mode." : "Registration is disabled. Login only."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!registerEnabled && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">Registration is disabled. Login only.</p>}
            <Button variant="outline" className="w-full gap-2" onClick={() => handleSsoLoginClick("github")} disabled={!canUseGithubSso || ssoLoginPendingProvider !== null || loginMutation.isPending || passkeyLoginPending}>
              <Github className="h-4 w-4" />
              {ssoLoginPendingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
            </Button>
            {canUseGoogleSso && (
              <Button variant="outline" className="w-full gap-2" onClick={() => handleSsoLoginClick("google")} disabled={ssoLoginPendingProvider !== null || loginMutation.isPending || passkeyLoginPending}>
                <span className="text-sm font-semibold text-primary">G</span>
                {ssoLoginPendingProvider === "google" ? "Connecting..." : "Continue with Google"}
              </Button>
            )}
            {ssoLoginError && <p className="text-xs text-muted-foreground">{ssoLoginError}</p>}
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border"></span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border"></span>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => { void handlePasskeyLoginClick(); }} disabled={ssoLoginPendingProvider !== null || loginMutation.isPending || passkeyLoginPending}>
              <KeyRound className="h-4 w-4" />
              {passkeyLoginPending ? "Connecting..." : "Continue with Passkey"}
            </Button>
            {passkeyLoginError && <p className="text-xs text-muted-foreground">{passkeyLoginError}</p>}
            {passwordLoginEnabled && (
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border"></span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border"></span>
              </div>
            )}
          </div>
          {passwordLoginEnabled && (
            <form onSubmit={(event) => { void handleLoginSubmit(event); }} className="space-y-5">
              <div className="grid gap-2">
                <label htmlFor="login-username" className="text-xs font-medium text-foreground">Username</label>
                <Input id="login-username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} placeholder="you@example.com" autoComplete="username" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="login-password" className="text-xs font-medium text-foreground">Password</label>
                <Input id="login-password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" />
              </div>
              {loginError && <p className="text-xs text-destructive">{loginError}</p>}
              <DialogFooter className="flex-col sm:flex-col gap-2">
                <Button type="submit" className="w-full" disabled={!canSubmitLogin}>
                  {loginMutation.isPending ? "Logging in..." : "Login"}
                </Button>
                {canOpenRegisterDialog && (
                  <Button type="button" variant="outline" className="w-full" onClick={handleOpenRegisterDialog}>
                    Register account
                  </Button>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRegisterDialogOpen} onOpenChange={setRegisterDialogOpenState}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create an account</DialogTitle>
            <DialogDescription>Enter username and password to register a new account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { void handleRegisterSubmit(event); }} className="space-y-5">
            <div className="grid gap-2">
              <label htmlFor="register-username" className="text-xs font-medium text-foreground">Username</label>
              <Input id="register-username" value={registerUsername} onChange={(event) => setRegisterUsername(event.target.value)} placeholder="your-name" autoComplete="username" />
              {registerUsernameLengthError && <p className="text-xs text-destructive">{registerUsernameLengthError}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="register-password" className="text-xs font-medium text-foreground">Password</label>
              <Input id="register-password" type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} autoComplete="new-password" />
              {registerPasswordLengthError && <p className="text-xs text-destructive">{registerPasswordLengthError}</p>}
            </div>
            {registerError && <p className="text-xs text-destructive">{registerError}</p>}
            <DialogFooter className="flex-col gap-2">
              <Button type="submit" className="w-full" disabled={!canSubmitRegister}>
                {registerMutation.isPending ? "Registering..." : "Register"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => { setRegisterDialogOpenState(false); onOpenChange(true); }}>
                Back to login
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
