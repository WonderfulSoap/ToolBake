import { useEffect, useMemo, useState } from "react";
import { Github, Settings, AlertTriangle, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useSaveSettings, useSettings } from "~/hooks/use-settings";
import { ErrorHandler } from "~/error/error-checker";
import { useAuthContext } from "~/contexts/auth-context";
import { useUserInfo } from "~/hooks/use-auth";
import { globalDI } from "~/di/global-di";
import { queryClient } from "~/lib/query-client";
import type { Passkey, PasskeyRegisterRequest, SsoBinding, SsoProvider, TotpSetupInfo } from "~/data/interface/i-auth-repository";
import { buildGithubAuthorizeUrl, buildGoogleAuthorizeUrl, generateSsoStateId, getSsoStateStorageKey } from "~/lib/sso";
import { base64UrlToArrayBuffer } from "~/lib/utils";

interface SettingsDialogProps {
  onReportError?    : (source: string, message?: string, error?: unknown) => void;
  open?             : boolean;
  onOpenChange?     : (open: boolean) => void;
  activeTab?        : string;
  onActiveTabChange?: (tab: string) => void;
}

/**
 * Settings button and dialog component for configuring OpenAI credentials.
 * Extracted from Header to reduce complexity and improve maintainability.
 */
export function SettingsDialog({ onReportError, open, onOpenChange, activeTab: activeTabProp, onActiveTabChange }: SettingsDialogProps) {
  const { mode, forceLogout } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("openai");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [openAiApiUrl, setOpenAiApiUrl] = useState("https://api.openai.com/v1");
  const [openAiModel, setOpenAiModel] = useState("gpt-5-mini");
  const [ssoActionError, setSsoActionError] = useState<string>();
  const [passkeyError, setPasskeyError] = useState<string>();
  const [passkeyListError, setPasskeyListError] = useState<string>();
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<number | null>(null);
  // Optional device label to help users identify this passkey later.
  const [passkeyDeviceName, setPasskeyDeviceName] = useState("");
  // 2FA tab state
  const [totpSetupInfo, setTotpSetupInfo] = useState<TotpSetupInfo | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [twoFaError, setTwoFaError] = useState<string>();
  // Recovery code shown after successful 2FA setup
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  // 2FA deletion confirmation state
  const [showDelete2FaConfirm, setShowDelete2FaConfirm] = useState(false);
  const [delete2FaCode, setDelete2FaCode] = useState("");
  // Clear local data confirmation state (guest mode only, two-step confirmation)
  const [clearDataStep, setClearDataStep] = useState<0 | 1 | 2>(0);
  const [clearDataConfirmText, setClearDataConfirmText] = useState("");
  // Recovery code action helpers keep UX consistent and avoid repeating logic in JSX.
  async function handleCopyRecoveryCode() {
    if (!recoveryCode) return;
    // Clipboard write can fail on insecure contexts, so guard and surface a concise error.
    try {
      await navigator.clipboard.writeText(recoveryCode);
    } catch (error) {
      ErrorHandler.processError(error);
      setTwoFaError("Failed to copy recovery code.");
    }
  }

  // Download as a plain text file for safe offline storage.
  function handleDownloadRecoveryCode() {
    if (!recoveryCode) return;
    try {
      const blob = new Blob([recoveryCode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "2fa-recovery-code.txt";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      ErrorHandler.processError(error);
      setTwoFaError("Failed to download recovery code.");
    }
  }

  const settingsQuery = useSettings();
  const saveSettingsMutation = useSaveSettings();
  const settingsData = settingsQuery.data;
  const isLoggedIn = mode === "logined";
  const { data: userInfo } = useUserInfo();
  // Allow controlled open/tab state from the header while preserving local defaults.
  const dialogOpen = open ?? isOpen;
  const dialogTab = activeTabProp ?? activeTab;

  // Profile tab state
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string>();
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Check username availability mutation
  const checkUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const exists = await globalDI.userRepository.checkUsernameExists(username);
      return !exists;
    },
    onSuccess: (available) => {
      setUsernameChecked(true);
      setUsernameAvailable(available);
      if (!available) setUsernameError("Username is already taken.");
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      setUsernameError(error instanceof Error ? error.message : "Failed to check username.");
    },
  });

  // Update username mutation
  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => globalDI.userRepository.updateUserInfo({ username }),
    onSuccess : () => {
      void queryClient.invalidateQueries({ queryKey: ["user", "info"] });
      setUsernameChecked(false);
      setUsernameAvailable(false);
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      setUsernameError(error instanceof Error ? error.message : "Failed to update username.");
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => globalDI.userRepository.deleteUser(),
    onSuccess : () => {
      handleOpenChange(false);
      forceLogout();
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      onReportError?.("profile.delete", error instanceof Error ? error.message : "Failed to delete account.", error);
    },
  });
  const githubSsoConfig = useMemo(() => readGithubSsoConfig(), []);
  const googleSsoConfig = useMemo(() => readGoogleSsoConfig(), []);
  const canUseGithubSso = (githubSsoConfig?.clientId?.trim() || "").length > 0;
  const canUseGoogleSso = (googleSsoConfig?.clientId?.trim() || "").length > 0;

  const ssoBindingsQuery = useQuery({
    queryKey: ["user", "sso", "bindings", mode],
    queryFn : async () => {
      if (!isLoggedIn) return [];
      try {
        return await globalDI.authHelper.getSsoBindings();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    enabled: dialogOpen && isLoggedIn,
  });

  const unbindSsoMutation = useMutation({
    mutationFn: async (provider: SsoProvider) => globalDI.authHelper.deleteSsoBinding(provider),
    onSuccess : () => void queryClient.invalidateQueries({ queryKey: ["user", "sso", "bindings"] }),
  });

  const passkeysQuery = useQuery({
    queryKey: ["user", "passkeys", mode],
    queryFn : async () => {
      if (!isLoggedIn) return [];
      try {
        return await globalDI.authHelper.getPasskeys();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    enabled: dialogOpen && isLoggedIn && dialogTab === "account",
  });

  // 2FA list query
  const twoFaListQuery = useQuery({
    queryKey: ["user", "2fa", "list", mode],
    queryFn : async () => {
      if (!isLoggedIn) return [];
      try {
        return await globalDI.authHelper.get2FaList();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    enabled: dialogOpen && isLoggedIn && dialogTab === "2fa",
  });

  // Get TOTP setup info mutation
  const getTotpSetupMutation = useMutation({
    mutationFn: async () => globalDI.authHelper.get2FaTotpSetup(),
    onSuccess : (data) => {
      setTotpSetupInfo(data);
      setTotpCode("");
      setTwoFaError(undefined);
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      setTwoFaError(error instanceof Error ? error.message : "Failed to get TOTP setup info.");
    },
  });

  // Add TOTP 2FA mutation
  const addTotpMutation = useMutation({
    mutationFn: async ({ token, code }: { token: string; code: string }) => globalDI.authHelper.add2FaTotp(token, code),
    onSuccess : (returnedRecoveryCode) => {
      setTotpSetupInfo(null);
      setTotpCode("");
      setTwoFaError(undefined);
      setRecoveryCode(returnedRecoveryCode);
      void queryClient.invalidateQueries({ queryKey: ["user", "2fa", "list"] });
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      setTwoFaError(error instanceof Error ? error.message : "Failed to add TOTP 2FA.");
    },
  });

  // Delete 2FA mutation
  const delete2FaMutation = useMutation({
    mutationFn: async (code: string) => globalDI.authHelper.delete2Fa("totp", code),
    onSuccess : () => {
      setTwoFaError(undefined);
      setShowDelete2FaConfirm(false);
      setDelete2FaCode("");
      void queryClient.invalidateQueries({ queryKey: ["user", "2fa", "list"] });
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      setTwoFaError(error instanceof Error ? error.message : "Failed to delete 2FA.");
    },
  });
 
  const deletePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: number) => {
      // Deleting passkeys requires an access token; repository handles it internally.
      await globalDI.authHelper.deletePasskey(passkeyId);
    },
    onSuccess: () => {
      setPasskeyListError(undefined);
      void queryClient.invalidateQueries({ queryKey: ["user", "passkeys"] });
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to delete passkey.";
      setPasskeyListError(message);
      onReportError?.("settings.passkey.delete", message, error);
    },
    onSettled: () => {
      setDeletingPasskeyId(null);
    },
  });

  /** Convert WebAuthn ArrayBuffer payloads to base64url strings for API transport. */
  function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  /** Build passkey registration payload from browser credential for API verification. */
  function buildPasskeyRegisterRequest(credential: PublicKeyCredential, deviceName?: string): PasskeyRegisterRequest {
    const response = credential.response as AuthenticatorAttestationResponse;
    if (!response?.attestationObject || !response.clientDataJSON) throw new Error("Invalid passkey response.");
    const normalizedDeviceName = deviceName?.trim();
    return {
      authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
      clientExtensionResults : { ...credential.getClientExtensionResults?.() },
      deviceName             : normalizedDeviceName?.length ? normalizedDeviceName : undefined,
      id                     : credential.id,
      rawId                  : arrayBufferToBase64Url(credential.rawId),
      response               : {
        attestationObject: arrayBufferToBase64Url(response.attestationObject),
        clientDataJSON   : arrayBufferToBase64Url(response.clientDataJSON),
        transports       : response.getTransports?.() ?? undefined,
      },
      type: credential.type,
    };
  }

  // Passkey registration mutation: get challenge then call navigator.credentials.create()
  const passkeyChallengeMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Get challenge from server
      const challenge = await globalDI.authHelper.getPasskeyChallenge();

      // Step 2: Convert challenge to WebAuthn format and call navigator.credentials.create()
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64UrlToArrayBuffer(challenge.challenge),
        rp       : challenge.rp,
        user     : {
          id         : base64UrlToArrayBuffer(challenge.user.id),
          name       : challenge.user.name,
          displayName: challenge.user.displayName,
        },
        pubKeyCredParams: challenge.pubKeyCredParams.map((param) => ({
          type: param.type as PublicKeyCredentialType,
          alg : param.alg,
        })),
        timeout               : challenge.timeout,
        authenticatorSelection: challenge.authenticatorSelection ? {
          authenticatorAttachment: challenge.authenticatorSelection.authenticatorAttachment as AuthenticatorAttachment | undefined,
          requireResidentKey     : challenge.authenticatorSelection.requireResidentKey,
          residentKey            : challenge.authenticatorSelection.residentKey as ResidentKeyRequirement | undefined,
          userVerification       : challenge.authenticatorSelection.userVerification as UserVerificationRequirement | undefined,
        } : undefined,
        attestation       : (challenge.attestation || "none") as AttestationConveyancePreference,
        excludeCredentials: challenge.excludeCredentials?.map((cred) => ({
          type      : cred.type as PublicKeyCredentialType,
          id        : base64UrlToArrayBuffer(cred.id),
          transports: cred.transports as AuthenticatorTransport[] | undefined,
        })),
      };

      const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
      console.log("[Passkey] Credential created:", JSON.stringify(credential, null, 2));
      if (!credential) throw new Error("Failed to create passkey credential.");

      // Step 3: Send credential to server for verification/registration.
      const payload = buildPasskeyRegisterRequest(credential as PublicKeyCredential, passkeyDeviceName);
      await globalDI.authHelper.verifyPasskey(payload);
      // Return the credential for logging UI feedback.
      return credential as PublicKeyCredential;
    },
    onSuccess: (credential) => {
      console.log("[Passkey] Credential created:", credential);
      setPasskeyError(undefined);
      setPasskeyListError(undefined);
      void queryClient.invalidateQueries({ queryKey: ["user", "passkeys"] });
    },
    onError: (error) => {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to create passkey.";
      setPasskeyError(message);
      onReportError?.("settings.passkey.create", message, error);
    },
  });

  const boundProviders = useMemo(() => new Set((ssoBindingsQuery.data ?? []).map((binding) => binding.provider)), [ssoBindingsQuery.data]);
  const boundCount = ssoBindingsQuery.data?.length ?? 0;
  const showGoogleRow = canUseGoogleSso || boundProviders.has("google");

  const openAiApiKeySettingKey = "openaiApiKey";
  const openAiApiUrlSettingKey = "openaiApiUrl";
  const openAiModelSettingKey = "openaiModel";
  const defaultOpenAiApiUrl = "https://api.openai.com/v1";
  const defaultOpenAiModel = "gpt-5-mini";

  // Hydrate dialog inputs from settings when opened.
  useEffect(() => {
    if (!dialogOpen) return;
    const otherInfo = settingsData?.otherInfo ?? {};
    const storedApiKey = otherInfo[openAiApiKeySettingKey] ?? "";
    const storedApiUrl = otherInfo[openAiApiUrlSettingKey] ?? "";
    const storedModel = otherInfo[openAiModelSettingKey] ?? "";
    setOpenAiApiKey(storedApiKey);
    setOpenAiApiUrl(storedApiUrl.trim() || defaultOpenAiApiUrl);
    setOpenAiModel(storedModel.trim() || defaultOpenAiModel);
    setPasskeyDeviceName("");
    setPasskeyListError(undefined);
    setDeletingPasskeyId(null);
    // Reset 2FA state
    setTotpSetupInfo(null);
    setTotpCode("");
    setTwoFaError(undefined);
    setRecoveryCode(null);
    setShowDelete2FaConfirm(false);
    setDelete2FaCode("");
    setClearDataStep(0);
    setClearDataConfirmText("");
  }, [dialogOpen, settingsData]);

  // Initialize profile tab state when opened.
  useEffect(() => {
    if (!dialogOpen) return;
    setNewUsername(userInfo?.name ?? "");
    setUsernameError(undefined);
    setUsernameChecked(false);
    setUsernameAvailable(false);
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
  }, [dialogOpen, userInfo]);

  function handleOpenChange(nextState: boolean) {
    if (onOpenChange) onOpenChange(nextState);
    else setIsOpen(nextState);
    if (!nextState) {
      setSsoActionError(undefined);
      setPasskeyError(undefined);
      setPasskeyListError(undefined);
      setDeletingPasskeyId(null);
    }
  }

  async function handleSaveClick() {
    const trimmedApiKey = openAiApiKey.trim();
    const normalizedApiUrl = openAiApiUrl.trim() || defaultOpenAiApiUrl;
    const trimmedModel = openAiModel.trim() || defaultOpenAiModel;
    const currentOtherInfo = settingsData?.otherInfo ?? {};
    const nextSettings = {
      otherInfo: {
        ...currentOtherInfo,
        [openAiApiKeySettingKey]: trimmedApiKey,
        [openAiApiUrlSettingKey]: normalizedApiUrl,
        [openAiModelSettingKey] : trimmedModel,
      },
    };
    try {
      await saveSettingsMutation.mutateAsync(nextSettings);
      handleOpenChange(false);
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      onReportError?.("settings.save", message, error);
    }
  }

  function handleClearLocalData() {
    // Clear all browser storage
    try {
      localStorage.clear();
      sessionStorage.clear();
      // Clear all IndexedDB databases
      if (globalThis.indexedDB?.databases) {
        void globalThis.indexedDB.databases().then((databases) => {
          for (const db of databases) {
            if (db.name) globalThis.indexedDB.deleteDatabase(db.name);
          }
        });
      }
      // Clear cookies
      document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    } catch (error) {
      ErrorHandler.processError(error);
    }
    // Reload to apply clean state
    window.location.reload();
  }

  function handleStartBind(provider: SsoProvider) {
    setSsoActionError(undefined);
    const config = provider === "github" ? githubSsoConfig : googleSsoConfig;
    if (!config?.clientId || !config.redirectUri) {
      const message = `${getProviderLabel(provider)} SSO is not configured.`;
      setSsoActionError(message);
      onReportError?.(`settings.sso.${provider}.config`, message);
      return;
    }
    try {
      const state = generateSsoStateId();
      const authorizeUrl = provider === "github"
        ? buildGithubAuthorizeUrl(config.clientId, config.redirectUri, state)
        : buildGoogleAuthorizeUrl(config.clientId, config.redirectUri, state);
      const stateKey = getSsoStateStorageKey(provider);
      // Log the state key/value for debugging the SSO binding flow.
      console.info("[SSO][settings] state generated", { key: stateKey, value: state });
      globalThis?.localStorage?.setItem(stateKey, state);
      globalThis?.localStorage?.setItem(getSsoBindIntentStorageKey(), provider);
      window.location.assign(authorizeUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to start ${getProviderLabel(provider)} binding.`;
      setSsoActionError(message);
      onReportError?.(`settings.sso.${provider}.bind`, message, error);
    }
  }

  function handleUnbind(provider: SsoProvider) {
    setSsoActionError(undefined);
    unbindSsoMutation.mutate(provider, {
      onError: (error) => {
        ErrorHandler.processError(error);
        const message = error instanceof Error ? error.message : `Failed to unbind ${getProviderLabel(provider)}.`;
        setSsoActionError(message);
        onReportError?.(`settings.sso.${provider}.unbind`, message, error);
      },
    });
  }

  function formatPasskeyLastUsed(passkey: Passkey): string {
    // Fallback to ISO string if local formatting fails.
    try {
      return passkey.lastUsedAt instanceof Date ? passkey.lastUsedAt.toLocaleString() : new Date(passkey.lastUsedAt).toLocaleString();
    } catch {
      return passkey.lastUsedAt instanceof Date ? passkey.lastUsedAt.toISOString() : new Date(passkey.lastUsedAt).toISOString();
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => handleOpenChange(true)} className="rounded-full" aria-label="Open settings">
        <Settings className="h-4 w-4" />
      </Button>
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Configure OpenAI credentials and account bindings.</DialogDescription>
          </DialogHeader>
          <Tabs value={dialogTab} onValueChange={(value) => { if (onActiveTabChange) { onActiveTabChange(value); } else { setActiveTab(value); } }} className="w-full">
            <TabsList className="w-full justify-start bg-transparent p-0 h-auto">
              <TabsTrigger value="openai" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-muted/60">
                OpenAI
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-muted/60">
                Profile
              </TabsTrigger>
              <TabsTrigger value="account" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-muted/60">
                Account
              </TabsTrigger>
              <TabsTrigger value="2fa" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-muted/60">
                2FA
              </TabsTrigger>
              {mode === "local" && (
                <TabsTrigger value="data" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-muted/60 text-destructive">
                  Data
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="openai" className="space-y-5">
              <div className="grid gap-2">
                <label htmlFor="openai-api-key" className="text-xs font-medium text-foreground">
                  OpenAI API Key
                </label>
                <Input
                  id="openai-api-key"
                  type="password"
                  value={openAiApiKey}
                  onChange={(event) => setOpenAiApiKey(event.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Used for calling OpenAI APIs in your tools.
                </p>
              </div>
              <div className="grid gap-2">
                <label htmlFor="openai-api-url" className="text-xs font-medium text-foreground">
                  OpenAI API Base URL
                </label>
                <Input
                  id="openai-api-url"
                  value={openAiApiUrl}
                  onChange={(event) => setOpenAiApiUrl(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
                <p className="text-[11px] text-muted-foreground">
                  Default is https://api.openai.com/v1.
                </p>
              </div>
              <div className="grid gap-2">
                <label htmlFor="openai-model" className="text-xs font-medium text-foreground">
                  OpenAI Model
                </label>
                <Input
                  id="openai-model"
                  value={openAiModel}
                  onChange={(event) => setOpenAiModel(event.target.value)}
                  placeholder="gpt-5-mini"
                />
                <p className="text-[11px] text-muted-foreground">
                  Optional default model name for tool requests.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="profile" className="space-y-5">
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground">Login to manage your profile.</p>
              )}
              {isLoggedIn && (
                <div className="space-y-5">
                  {/* Username section */}
                  <div className="grid gap-2">
                    <label htmlFor="profile-username" className="text-xs font-medium text-foreground">
                      Username
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="profile-username"
                        value={newUsername}
                        onChange={(e) => { setNewUsername(e.target.value); setUsernameError(undefined); setUsernameChecked(false); setUsernameAvailable(false); }}
                        placeholder="Enter new username"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!newUsername.trim() || newUsername === userInfo?.name || checkUsernameMutation.isPending}
                        onClick={() => checkUsernameMutation.mutate(newUsername.trim())}
                      >
                        {checkUsernameMutation.isPending ? "..." : "Check"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!usernameChecked || !usernameAvailable || updateUsernameMutation.isPending}
                        onClick={() => updateUsernameMutation.mutate(newUsername.trim())}
                      >
                        {updateUsernameMutation.isPending ? "..." : "Apply"}
                      </Button>
                    </div>
                    {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                    {usernameChecked && usernameAvailable && <p className="text-xs text-green-600">Username is available.</p>}
                    <p className="text-[11px] text-muted-foreground">
                      Username must be 3-32 characters.
                    </p>
                  </div>

                  {/* Danger zone */}
                  <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-medium text-destructive">Danger Zone</p>
                    </div>
                    {!showDeleteConfirm ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-foreground">Delete Account</p>
                          <p className="text-[11px] text-muted-foreground">
                            Permanently delete your account and all data.
                          </p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Type <span className="font-mono font-semibold text-destructive">DELETE</span> to confirm account deletion. This action cannot be undone.
                        </p>
                        <Input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Type DELETE to confirm"
                          className="border-destructive/50 focus-visible:ring-destructive/30"
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteConfirmText !== "DELETE" || deleteUserMutation.isPending}
                            onClick={() => deleteUserMutation.mutate()}
                          >
                            {deleteUserMutation.isPending ? "Deleting..." : "Confirm Delete"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="account" className="space-y-4">
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground">Login to manage your SSO bindings.</p>
              )}
              {isLoggedIn && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium text-foreground">GitHub</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ssoBindingsQuery.isLoading ? "Loading..." : formatSsoBindingDetail(ssoBindingsQuery.data ?? [], "github")}
                        </p>
                      </div>
                    </div>
                    {boundProviders.has("github") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={boundCount <= 1 || unbindSsoMutation.isPending}
                        onClick={() => handleUnbind("github")}
                      >
                        Unbind
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleStartBind("github")} disabled={!canUseGithubSso}>
                        Bind
                      </Button>
                    )}
                  </div>
                  {showGoogleRow && (
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">G</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">Google</p>
                          <p className="text-[11px] text-muted-foreground">
                            {ssoBindingsQuery.isLoading ? "Loading..." : formatSsoBindingDetail(ssoBindingsQuery.data ?? [], "google")}
                          </p>
                        </div>
                      </div>
                      {boundProviders.has("google") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={boundCount <= 1 || unbindSsoMutation.isPending}
                          onClick={() => handleUnbind("google")}
                        >
                          Unbind
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleStartBind("google")} disabled={!canUseGoogleSso}>
                          Bind
                        </Button>
                      )}
                    </div>
                  )}
                  {ssoActionError && <p className="text-xs text-destructive">{ssoActionError}</p>}
                  {boundCount <= 1 && (boundProviders.has("github") || boundProviders.has("google")) && (
                    <p className="text-[11px] text-muted-foreground">
                      At least one SSO account must remain linked.
                    </p>
                  )}

                  {/* Passkey section */}
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="rounded-lg border border-border px-3 py-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Passkey</p>
                            <p className="text-[11px] text-muted-foreground">
                              Register a passkey for passwordless login.
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={passkeyChallengeMutation.isPending}
                          onClick={() => passkeyChallengeMutation.mutate()}
                        >
                          {passkeyChallengeMutation.isPending ? "Loading..." : "Add Passkey"}
                        </Button>
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="passkey-device-name" className="text-xs font-medium text-foreground">
                          Device Name (optional)
                        </label>
                        <Input
                          id="passkey-device-name"
                          value={passkeyDeviceName}
                          onChange={(event) => setPasskeyDeviceName(event.target.value)}
                          placeholder="e.g. MacBook Pro"
                          disabled={passkeyChallengeMutation.isPending}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Helps you recognize this passkey in your account.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {passkeysQuery.isLoading && <p className="text-xs text-muted-foreground">Loading passkeys...</p>}
                      {!passkeysQuery.isLoading && (passkeysQuery.data ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground">No passkeys registered yet.</p>
                      )}
                      {(passkeysQuery.data ?? []).map((passkey) => (
                        <div key={passkey.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{passkey.deviceName || "Unnamed device"}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Last used: {formatPasskeyLastUsed(passkey)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deletePasskeyMutation.isPending || deletingPasskeyId === passkey.id}
                            onClick={() => {
                              setDeletingPasskeyId(passkey.id);
                              deletePasskeyMutation.mutate(passkey.id);
                            }}
                          >
                            {deletingPasskeyId === passkey.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      ))}
                      {passkeyListError && <p className="text-xs text-destructive">{passkeyListError}</p>}
                    </div>
                    {passkeyError && <p className="text-xs text-destructive mt-2">{passkeyError}</p>}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="2fa" className="space-y-4">
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground">Login to manage two-factor authentication.</p>
              )}
              {isLoggedIn && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-[11px] text-muted-foreground">Add an extra layer of security to your account.</p>
                    </div>
                  </div>

                  {twoFaListQuery.isLoading && <p className="text-xs text-muted-foreground">Loading 2FA status...</p>}

                  {!twoFaListQuery.isLoading && (() => {
                    const totpEntry = (twoFaListQuery.data ?? []).find((item) => item.type === "totp" && item.enabled);

                    // Show recovery code after successful 2FA setup
                    if (recoveryCode) {
                      return (
                        <div className="rounded-lg border border-green-500/50 bg-green-500/5 px-3 py-3 space-y-3">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">2FA Enabled Successfully!</p>
                            <p className="text-xs text-muted-foreground">
                              Save this recovery code in a safe place. You can use it to disable 2FA if you lose access to your authenticator app.
                            </p>
                          </div>
                          <div className="rounded bg-muted p-3 text-center">
                            <code className="text-sm font-mono font-semibold tracking-wide text-foreground select-all break-all whitespace-pre-wrap">{recoveryCode}</code>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => { void handleCopyRecoveryCode(); }}>Copy</Button>
                            <Button size="sm" variant="outline" onClick={handleDownloadRecoveryCode}>Download .txt</Button>
                          </div>
                          <p className="text-[11px] text-destructive font-medium">
                            This code will only be shown once. Make sure to save it now!
                          </p>
                          <Button size="sm" onClick={() => setRecoveryCode(null)}>
                            I have saved the recovery code
                          </Button>
                        </div>
                      );
                    }

                    if (totpEntry) {
                      // TOTP is enabled, show status and delete option
                      return (
                        <div className="rounded-lg border border-border px-3 py-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">TOTP Authenticator</p>
                              <p className="text-[11px] text-muted-foreground">
                                Enabled since {totpEntry.createdAt instanceof Date ? totpEntry.createdAt.toLocaleDateString() : new Date(totpEntry.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            {!showDelete2FaConfirm && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowDelete2FaConfirm(true)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          {showDelete2FaConfirm && (
                            <div className="border-t border-border pt-3 space-y-3">
                              <p className="text-xs text-muted-foreground">
                                Enter your current TOTP code to confirm removal.
                              </p>
                              <div className="flex gap-2">
                                <Input
                                  value={delete2FaCode}
                                  onChange={(e) => { setDelete2FaCode(e.target.value); setTwoFaError(undefined); }}
                                  placeholder="000000"
                                  maxLength={6}
                                  className="flex-1"
                                  disabled={delete2FaMutation.isPending}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={delete2FaMutation.isPending}
                                  onClick={() => { setShowDelete2FaConfirm(false); setDelete2FaCode(""); setTwoFaError(undefined); }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={delete2FaCode.trim().length !== 6 || delete2FaMutation.isPending}
                                  onClick={() => delete2FaMutation.mutate(delete2FaCode.trim())}
                                >
                                  {delete2FaMutation.isPending ? "Removing..." : "Confirm"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // TOTP not enabled, show setup flow
                    if (!totpSetupInfo) {
                      return (
                        <div className="rounded-lg border border-border px-3 py-3 space-y-3">
                          <p className="text-xs text-muted-foreground">
                            No two-factor authentication enabled. Add TOTP to secure your account.
                          </p>
                          <Button
                            size="sm"
                            disabled={getTotpSetupMutation.isPending}
                            onClick={() => getTotpSetupMutation.mutate()}
                          >
                            {getTotpSetupMutation.isPending ? "Loading..." : "Setup TOTP"}
                          </Button>
                        </div>
                      );
                    }

                    // Show QR code and code input
                    return (
                      <div className="rounded-lg border border-border px-3 py-3 space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">Scan QR Code</p>
                          <p className="text-[11px] text-muted-foreground">
                            Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).
                          </p>
                          <div className="flex justify-center py-2">
                            <img
                              src={`data:image/png;base64,${totpSetupInfo.qrCode}`}
                              alt="TOTP QR Code"
                              className="w-48 h-48 border border-border rounded"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">
                            Or enter this secret manually: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{totpSetupInfo.secret}</code>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="totp-code" className="text-xs font-medium text-foreground">
                            Enter Verification Code
                          </label>
                          <div className="flex gap-2">
                            <Input
                              id="totp-code"
                              value={totpCode}
                              onChange={(e) => { setTotpCode(e.target.value); setTwoFaError(undefined); }}
                              placeholder="000000"
                              maxLength={6}
                              className="flex-1"
                              disabled={addTotpMutation.isPending}
                            />
                            <Button
                              size="sm"
                              disabled={totpCode.trim().length !== 6 || addTotpMutation.isPending}
                              onClick={() => addTotpMutation.mutate({ token: totpSetupInfo.token, code: totpCode.trim() })}
                            >
                              {addTotpMutation.isPending ? "Verifying..." : "Verify"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Enter the 6-digit code from your authenticator app.
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setTotpSetupInfo(null); setTotpCode(""); setTwoFaError(undefined); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    );
                  })()}

                  {twoFaError && <p className="text-xs text-destructive">{twoFaError}</p>}
                </div>
              )}
            </TabsContent>
            {mode === "local" && (
              <TabsContent value="data" className="space-y-4">
                <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <p className="text-sm font-medium text-destructive">Clear Local Data</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Permanently delete all locally stored data in your local browser, including settings, tools, and scripts. This action cannot be undone.
                  </p>
                  {clearDataStep === 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setClearDataStep(1)}>
                      Clear All Data
                    </Button>
                  )}
                  {clearDataStep === 1 && (
                    <div className="space-y-3">
                      <p className="text-xs text-destructive font-medium">
                        Are you sure? All your local data will be permanently deleted.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setClearDataStep(0)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setClearDataStep(2)}>
                          Yes, Continue
                        </Button>
                      </div>
                    </div>
                  )}
                  {clearDataStep === 2 && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Type <span className="font-mono font-semibold text-destructive">CLEAR</span> to confirm deletion.
                      </p>
                      <Input
                        value={clearDataConfirmText}
                        onChange={(e) => setClearDataConfirmText(e.target.value)}
                        placeholder="Type CLEAR to confirm"
                        className="border-destructive/50 focus-visible:ring-destructive/30"
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setClearDataStep(0); setClearDataConfirmText(""); }}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={clearDataConfirmText !== "CLEAR"}
                          onClick={handleClearLocalData}
                        >
                          Confirm Clear
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
          {dialogTab === "openai" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => { void handleSaveClick(); }} disabled={saveSettingsMutation.isPending}>
                {saveSettingsMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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

function getSsoBindIntentStorageKey() {
  return "YA_SSO_BIND_PROVIDER";
}

function getProviderLabel(provider: SsoProvider) {
  if (provider === "github") return "GitHub";
  if (provider === "google") return "Google";
  return "SSO";
}

function formatSsoBindingDetail(bindings: SsoBinding[], provider: SsoProvider) {
  const binding = bindings.find((item) => item.provider === provider);
  if (!binding) return "Not linked yet.";
  const identity = [binding.providerUsername, binding.providerEmail].filter(Boolean).join(" · ");
  return identity || "Linked.";
}
