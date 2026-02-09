export type AccessToken = {
  accessToken         : string;
  accessTokenExpiresAt: Date;
};

export type RefreshToken = {
  refreshToken         : string;
  refreshTokenExpiresAt: Date;
};

/** Supported SSO providers. */
export type SsoProvider = "github" | "google";

/** SSO binding entity representing a linked third-party account. */
export type SsoBinding = {
  provider        : SsoProvider;
  providerUserId  : string;
  providerUsername: string;
  providerEmail   : string;
  createdAt       : Date;
};

/** Passkey authenticator selection criteria for WebAuthn registration. */
export type PasskeyAuthenticatorSelection = {
  authenticatorAttachment?: string;
  requireResidentKey?     : boolean;
  residentKey?            : string;
  userVerification?       : string;
};

/** Passkey credential descriptor for excluding existing credentials. */
export type PasskeyCredentialDescriptor = {
  id         : string;
  type       : string;
  transports?: string[];
};

/** Passkey attestation response payload from WebAuthn credential creation. */
export type PasskeyAttestationResponse = {
  attestationObject: string;
  clientDataJSON   : string;
  transports?      : string[];
};

/** Passkey credential payload for WebAuthn registration verification. */
export type PasskeyRegisterRequest = {
  authenticatorAttachment?: string;
  clientExtensionResults? : Record<string, unknown>;
  deviceName?             : string;
  id                      : string;
  rawId                   : string;
  response                : PasskeyAttestationResponse;
  type                    : string;
};

/** Passkey public key credential creation options for WebAuthn registration. */
export type PasskeyCreationOptions = {
  attestation            : string;
  authenticatorSelection?: PasskeyAuthenticatorSelection;
  challenge              : string;
  excludeCredentials?    : PasskeyCredentialDescriptor[];
  pubKeyCredParams       : Array<{ alg: number; type: string }>;
  rp                     : { id: string; name: string };
  timeout                : number;
  user                   : { id: string; name: string; displayName: string };
};

/** Passkey public key credential request options for WebAuthn login. */
export type PasskeyRequestOptions = {
  allowCredentials?: PasskeyCredentialDescriptor[];
  challenge        : string;
  rpId             : string;
  timeout          : number;
  userVerification?: string;
};

/** Passkey assertion response payload from WebAuthn credential assertion. */
export type PasskeyAssertionResponse = {
  authenticatorData: string;
  clientDataJSON   : string;
  signature        : string;
  userHandle?      : string;
};

/** Passkey credential payload for WebAuthn login verification. */
export type PasskeyLoginRequest = {
  authenticatorAttachment?: string;
  clientExtensionResults? : Record<string, unknown>;
  id                      : string;
  rawId                   : string;
  response                : PasskeyAssertionResponse;
  type                    : string;
};

/** Passkey entity for listing registered passkeys. */
export type Passkey = {
  id          : number;
  credentialId: string;
  deviceName  : string;
  lastUsedAt  : Date;
};

/** 2FA type (currently only TOTP is supported). */
export type TwoFaType = "totp";

/** 2FA info entity for listing enabled 2FA methods. */
export type TwoFaInfo = {
  type     : TwoFaType;
  enabled  : boolean;
  createdAt: Date;
};

/** TOTP setup info for 2FA enrollment. */
export type TotpSetupInfo = {
  /** Base64 encoded QR code PNG image. */
  qrCode: string;
  /** TOTP secret key. */
  secret: string;
  /** Token for verification (used when calling add2FaTotp). */
  token : string;
  /** TOTP URL (otpauth://...). */
  url   : string;
};

export interface IAuthRepository {
  login(username: string, password: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }>;
  /** Exchange OAuth code for access/refresh tokens using specified provider. */
  loginWithSso(provider: SsoProvider, oauthCode: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }>;
  /** Logout the current user using the internally resolved access token. */
  logout(): Promise<void>;
  updateAccessToken(refreshToken: string): Promise<AccessToken>;
  /** Fetch all SSO bindings for the current user. */
  getSsoBindings(): Promise<SsoBinding[]>;
  /** Add a new SSO binding using OAuth code. */
  addSsoBinding(provider: SsoProvider, oauthCode: string): Promise<void>;
  /** Remove an existing SSO binding by provider. */
  deleteSsoBinding(provider: SsoProvider): Promise<void>;
  /** Get passkey registration challenge from server for WebAuthn credential creation. */
  getPasskeyChallenge(): Promise<PasskeyCreationOptions>;
  /** Verify and register passkey credential created by WebAuthn. */
  verifyPasskey(credential: PasskeyRegisterRequest): Promise<void>;
  /** Get passkey login challenge from server for WebAuthn credential assertion. No access token required. */
  getPasskeyLoginChallenge(): Promise<PasskeyRequestOptions>;
  /** Verify passkey login credential and exchange for tokens. No access token required. */
  verifyPasskeyLogin(credential: PasskeyLoginRequest): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }>;
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
  /** Complete login with 2FA verification. No access token required. */
  loginWith2Fa(token: string, code: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }>;
  /** Remove 2FA using recovery code. No access token required. */
  recover2Fa(token: string, recoveryCode: string): Promise<void>;
}
