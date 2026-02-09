import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAuthContext } from "~/contexts/auth-context";
import { useToastContext } from "~/contexts/toast-context";
import { globalDI } from "~/di/global-di";
import { ErrorHandler } from "~/error/error-checker";
import { queryClient } from "~/lib/query-client";
import { getSsoStateStorageKey } from "~/lib/sso";

type SsoStatus = "pending" | "success" | "error";
type SsoProvider = "github" | "google";

const processedSsoStates = new Set<string>();
const ssoInFlightKeyPrefix = "YA_SSO_OAUTH_INFLIGHT";
const ssoInFlightTtlMs = 5 * 60 * 1000;

export default function GithubSsoCallbackPage() {
  console.info("[SSOCallback] callback page start");
  const params = useParams<{ provider?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshMode } = useAuthContext();
  const { reportError, reportNotice } = useToastContext();
  const [status, setStatus] = useState<SsoStatus>("pending");
  const [message, setMessage] = useState("Completing SSO sign-in...");
  const provider = useMemo(() => normalizeProvider(params.provider), [params.provider]);
  const providerLabel = useMemo(() => getProviderLabel(provider), [provider]);
  const code = useMemo(() => (searchParams.get("code") ?? "").trim(), [searchParams]);
  const state = useMemo(() => (searchParams.get("state") ?? "").trim(), [searchParams]);
  const bindProvider = useMemo(() => readAndClearBindProvider(), []);
  const shouldBind = useMemo(() => resolveShouldBind(provider, bindProvider), [provider, bindProvider]);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    async function finalizeSso() {
      console.info("[SSOCallback] callback function start", { provider: params.provider, codePresent: Boolean(code), statePresent: Boolean(state) });
      try {
        // Avoid double-processing in React StrictMode (which would clear state and then fail).
        if (hasProcessedRef.current) return;
        hasProcessedRef.current = true;
        if (!provider) throw new Error("Unsupported SSO provider.");
        const processedKey = buildProcessedStateKey(provider, state);
        if (processedKey && processedSsoStates.has(processedKey)) return;
        const storedState = readSsoState(provider);
        console.log(`[SSOCallback] code: ${code}, state: ${state}, storedState: ${storedState}`);
        if (!code) throw new Error(`Missing ${providerLabel} OAuth code.`);
        if (!state) throw new Error(`Missing ${providerLabel} OAuth state.`);
        if (!storedState) throw new Error(`${providerLabel} SSO state is missing or expired.`);
        if (state !== storedState) throw new Error(`${providerLabel} SSO state mismatch.`);
        if (isSsoInFlight(provider, code, state)) return;
        if (processedKey) processedSsoStates.add(processedKey);
        markSsoInFlight(provider, code, state);
        if (shouldBind) {
          console.info("[SSO] binding request", { provider });
          await bindWithProvider(provider, code);
          console.info("[SSO] binding done");
        } else {
          console.info("[SSO] login request", { provider });
          await loginWithProvider(provider, code);
          console.info("[SSO] login done, refreshing mode");
          refreshMode();
        }
        clearSsoInFlight(provider, code, state);
        void queryClient.invalidateQueries({ queryKey: ["user"] });
        void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
        void queryClient.invalidateQueries({ queryKey: ["user", "sso", "bindings"] });
        reportNotice(`auth.sso.${provider}`, shouldBind ? `Linked ${providerLabel} account.` : `Signed in with ${providerLabel}.`);
        if (isActive) {
          setStatus("success");
          setMessage(shouldBind ? "Account linked. Redirecting..." : "Signed in. Redirecting...");
        }
        console.info("[SSO] redirecting to home");
        // Navigate with the router for a smoother UX; don't block on cleanup guards.
        window.setTimeout(() => void navigate("/", { replace: true }), 0);
        return;
      } catch (error) {
        ErrorHandler.processError(error);
        if (provider && code && state) clearSsoInFlight(provider, code, state);

        // Handle 2FA TOTP required: redirect to 2FA verification page
        if (ErrorHandler.isTwoFaTotpIsRequiredForLogin(error)) {
          const twoFaToken = extractTwoFaToken(error);
          if (twoFaToken) {
            console.info("[SSO] 2FA TOTP required, redirecting to verification page");
            if (isActive) {
              setStatus("pending");
              setMessage("Two-factor authentication required. Redirecting...");
            }
            window.setTimeout(() => void navigate(`/2fa/totp?token=${encodeURIComponent(twoFaToken)}`, { replace: true }), 0);
            return;
          }
        }

        const errorMessage = error instanceof Error ? error.message : "SSO failed.";
        console.error("[SSO] callback failed", { message: errorMessage, error });
        reportError(`auth.sso.${provider ?? "unknown"}`, errorMessage, error);
        if (!isActive) return;
        setStatus("error");
        setMessage(errorMessage);
      }
    }
    void finalizeSso();
    return () => {
      isActive = false;
    };
  }, [code, navigate, provider, providerLabel, refreshMode, reportError, reportNotice, state]);

  return (
    <div className="flex min-h-[calc(100vh-56px)] w-full items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-muted/30 p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-foreground">{providerLabel || "SSO"} Callback</p>
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        {status === "error" && (
          <p className="mt-3 text-xs text-destructive">Please try signing in again.</p>
        )}
      </div>
    </div>
  );
}

function normalizeProvider(raw?: string | null): SsoProvider | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "github") return "github";
  if (normalized === "google") return "google";
  return null;
}

function getProviderLabel(provider: SsoProvider | null) {
  if (provider === "github") return "GitHub";
  if (provider === "google") return "Google";
  return "";
}

function readSsoState(provider: SsoProvider) {
  const storageKey = getSsoStateStorageKey(provider);
  try {
    return (globalThis?.localStorage?.getItem(storageKey) ?? "").trim();
  } catch {
    return "";
  }
}

function buildProcessedStateKey(provider: SsoProvider, state: string) {
  const normalized = state?.trim();
  if (!normalized) return "";
  return `${provider}:${normalized}`;
}

function buildInFlightKey(provider: SsoProvider, code: string, state: string) {
  const normalizedCode = code?.trim();
  const normalizedState = state?.trim();
  if (!normalizedCode || !normalizedState) return "";
  return `${ssoInFlightKeyPrefix}:${provider}:${normalizedCode}:${normalizedState}`;
}

function isSsoInFlight(provider: SsoProvider, code: string, state: string) {
  const key = buildInFlightKey(provider, code, state);
  if (!key) return false;
  try {
    const raw = globalThis?.sessionStorage?.getItem(key) ?? "";
    if (!raw) return false;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) return false;
    if (Date.now() - timestamp > ssoInFlightTtlMs) return false;
    return true;
  } catch {
    return false;
  }
}

function markSsoInFlight(provider: SsoProvider, code: string, state: string) {
  const key = buildInFlightKey(provider, code, state);
  if (!key) return;
  try {
    globalThis?.sessionStorage?.setItem(key, String(Date.now()));
  } catch {
    // Ignore storage failures to avoid blocking SSO flow.
  }
}

function clearSsoInFlight(provider: SsoProvider, code: string, state: string) {
  const key = buildInFlightKey(provider, code, state);
  if (!key) return;
  try {
    globalThis?.sessionStorage?.removeItem(key);
  } catch {
    // Ignore storage failures to avoid blocking SSO flow.
  }
}

function resolveShouldBind(provider: SsoProvider | null, bindProvider: SsoProvider | null) {
  // Bind only when user explicitly requested it and access token already exists.
  if (!provider) return false;
  if (bindProvider !== provider) return false;
  return globalDI.authHelper.getMode() === "logined";
}

function readAndClearBindProvider(): SsoProvider | null {
  try {
    const stored = globalThis?.localStorage?.getItem("YA_SSO_BIND_PROVIDER") ?? "";
    globalThis?.localStorage?.removeItem("YA_SSO_BIND_PROVIDER");
    return normalizeProvider(stored);
  } catch {
    return null;
  }
}

async function loginWithProvider(provider: SsoProvider, code: string) {
  return globalDI.authHelper.loginWithSso(provider, code);
}

async function bindWithProvider(provider: SsoProvider, code: string) {
  return globalDI.authHelper.addSsoBinding(provider, code);
}

/** Extract two_fa_token from ApiError payload when 2FA is required. */
function extractTwoFaToken(error: unknown): string | null {
  if (!ErrorHandler.isApiError(error)) return null;
  const payload = error.payload as { extra_data?: { two_fa_token?: string } } | undefined;
  const token = payload?.extra_data?.two_fa_token?.trim();
  return token || null;
}
