import type { AccessToken, Passkey, PasskeyCreationOptions, PasskeyLoginRequest, PasskeyRegisterRequest, PasskeyRequestOptions, RefreshToken, SsoBinding, SsoProvider, TotpSetupInfo, TwoFaInfo, TwoFaType } from "./i-auth-repository";

export type AuthorizationHeaders = { Authorization: string };

export interface IAuthHelper {
  getMode(): "logined" | "local";
  newAccessToken(): Promise<AccessToken>;
  validateAccessToken(accessToken: AccessToken): Promise<boolean>;
  requireAccessToken(): Promise<AccessToken>;
  mustGetRefreshToken(): Promise<RefreshToken>;
  logout(): Promise<void>;
  forceLogout(): void;
  login(username: string, password: string): Promise<void>;
  /** Exchange OAuth code for tokens and persist them locally using specified provider. */
  loginWithSso(provider: SsoProvider, oauthCode: string): Promise<void>;
  /** Fetch all SSO bindings for the current user. */
  getSsoBindings(): Promise<SsoBinding[]>;
  /** Add a new SSO binding using OAuth code. */
  addSsoBinding(provider: SsoProvider, oauthCode: string): Promise<void>;
  /** Remove an existing SSO binding by provider. */
  deleteSsoBinding(provider: SsoProvider): Promise<void>;
  /** Get passkey registration challenge for WebAuthn credential creation. */
  getPasskeyChallenge(): Promise<PasskeyCreationOptions>;
  /** Verify and register passkey credential created by WebAuthn. */
  verifyPasskey(credential: PasskeyRegisterRequest): Promise<void>;
  /** Get passkey login challenge for WebAuthn credential assertion. No access token required. */
  getPasskeyLoginChallenge(): Promise<PasskeyRequestOptions>;
  /** Verify passkey login credential and persist tokens. No access token required. */
  loginWithPasskey(credential: PasskeyLoginRequest): Promise<void>;
  /** Get all registered passkeys for the current user. */
  getPasskeys(): Promise<Passkey[]>;
  /** Delete a registered passkey by id. */
  deletePasskey(passkeyId: number | bigint | string): Promise<void>;
  /** Get all enabled 2FA methods for the current user. */
  get2FaList(): Promise<TwoFaInfo[]>;
  /** Get TOTP setup info for 2FA enrollment. */
  get2FaTotpSetup(): Promise<TotpSetupInfo>;
  /** Verify TOTP code and enable 2FA for the user. Returns recovery code. */
  add2FaTotp(token: string, code: string): Promise<string>;
  /** Delete a 2FA method by type. Requires TOTP code for verification. */
  delete2Fa(type: TwoFaType, code: string): Promise<void>;
  /** Complete login with 2FA verification. Persists tokens on success. */
  loginWith2Fa(token: string, code: string): Promise<void>;
  /** Remove 2FA using recovery code. No access token required. */
  recover2Fa(token: string, recoveryCode: string): Promise<void>;
  executeWithAccessToken<T>(operation: (headers: AuthorizationHeaders) => Promise<T>, retryCount?: number): Promise<T>;
}
