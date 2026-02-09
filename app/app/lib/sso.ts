// Shared SSO helpers to keep state generation consistent across entry points.
export function generateSsoStateId() {
  if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getSsoStateStorageKey(provider: "github" | "google") {
  if (provider === "github") return "YA_SSO_GITHUB_STATE";
  if (provider === "google") return "YA_SSO_GOOGLE_STATE";
  return "YA_SSO_STATE";
}

/** Build GitHub OAuth authorize URL. */
export function buildGithubAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  const encodedClientId = encodeURIComponent(clientId);
  const encodedRedirect = encodeURIComponent(redirectUri);
  const encodedState = encodeURIComponent(state);
  return `https://github.com/login/oauth/authorize?client_id=${encodedClientId}&redirect_uri=${encodedRedirect}&state=${encodedState}`;
}

/** Build Google OAuth authorize URL. */
export function buildGoogleAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  const encodedClientId = encodeURIComponent(clientId);
  const encodedRedirect = encodeURIComponent(redirectUri);
  const encodedState = encodeURIComponent(state);
  const encodedScope = encodeURIComponent("openid email profile");
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodedClientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodedScope}&state=${encodedState}&prompt=select_account`;
}
