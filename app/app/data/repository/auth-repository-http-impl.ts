import type { Client } from "~/data/generated-http-client/client";
import { deleteApiV1Auth2Fa, deleteApiV1AuthPasskeysByPasskeyId, deleteApiV1AuthSsoBindings, getApiV1Auth2Fa, getApiV1Auth2FaTotp, getApiV1AuthPasskeys, getApiV1AuthSsoBindings, postApiV1Auth2FaLogin, postApiV1Auth2FaRecovery, postApiV1Auth2FaTotp, postApiV1AuthAccessToken, postApiV1AuthLogin, postApiV1AuthLogout, postApiV1AuthPasskeyLoginChallenge, postApiV1AuthPasskeyLoginVerify, postApiV1AuthPasskeyRegisterChallenge, postApiV1AuthPasskeyRegisterVerify, postApiV1AuthSsoByProvider, putApiV1AuthSsoByProvider } from "~/data/generated-http-client";
import { postApiV1AuthAccessTokenResponseTransformer, postApiV1AuthLoginResponseTransformer, postApiV1AuthPasskeyLoginVerifyResponseTransformer, postApiV1AuthSsoByProviderResponseTransformer } from "~/data/generated-http-client/transformers.gen";
import type { AccessToken, IAuthRepository, Passkey, PasskeyCreationOptions, PasskeyLoginRequest, PasskeyRegisterRequest, PasskeyRequestOptions, RefreshToken, SsoBinding, SsoProvider, TotpSetupInfo, TwoFaInfo, TwoFaType } from "../interface/i-auth-repository";
import type { IAuthHelper } from "../interface/i-auth-helper";
import { httpClient as sharedHttpClient, HttpClient } from "../http-client/http-client";
import { logAndThrow } from "~/lib/utils";

export class HttpAuthRepository implements IAuthRepository {
  private readonly client     : Client;
  private authHelper         ?: IAuthHelper;

  constructor(httpClient: HttpClient = sharedHttpClient) {
    this.client = httpClient.client;
  }

  // Inject auth helper after construction to avoid circular dependencies.
  public setAuthHelper(authHelper: IAuthHelper): void {
    this.authHelper = authHelper;
  }

  async login(username: string, password: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken; }> {
    const response = await postApiV1AuthLogin({
      client             : this.client,
      body               : { username, password },
      throwOnError       : true,
      responseTransformer: postApiV1AuthLoginResponseTransformer,
    });
    const payload = response.data?.data;
    if (!payload?.access_token || !payload.refresh_token) logAndThrow("Invalid login response.");
    return {
      accessToken : buildAccessToken(payload.access_token, payload.expires_in),
      refreshToken: buildRefreshToken(payload.refresh_token, payload.refresh_token_expires_in),
    };
  }

  async loginWithSso(provider: SsoProvider, oauthCode: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken; }> {
    // Exchange OAuth code for access/refresh tokens using specified provider.
    const normalized = oauthCode?.trim();
    const providerLabel = provider === "github" ? "GitHub" : "Google";
    if (!normalized) logAndThrow(`${providerLabel} OAuth code is required for SSO login.`);
    const response = await postApiV1AuthSsoByProvider({
      client             : this.client,
      path               : { provider },
      body               : { oauth_code: normalized },
      throwOnError       : true,
      responseTransformer: postApiV1AuthSsoByProviderResponseTransformer,
    });
    const payload = response.data?.data;
    if (!payload?.access_token || !payload.refresh_token) logAndThrow(`Invalid ${providerLabel} SSO response.`);
    return {
      accessToken : buildAccessToken(payload.access_token, payload.expires_in),
      refreshToken: buildRefreshToken(payload.refresh_token, payload.refresh_token_expires_in),
    };
  }

  async logout(): Promise<void> {
    // Resolve the access token internally and send it in the Authorization header.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      await postApiV1AuthLogout({ client: this.client, headers, throwOnError: true });
    });
  }

  async updateAccessToken(refreshToken: string): Promise<AccessToken> {
    const trimmed = refreshToken?.trim();
    if (!trimmed) logAndThrow("Refresh token is required to update access token.");
    const response = await postApiV1AuthAccessToken({
      client             : this.client,
      body               : { refresh_token: trimmed },
      throwOnError       : true,
      responseTransformer: postApiV1AuthAccessTokenResponseTransformer,
    });
    const payload = response.data?.data;
    if (!payload?.access_token) logAndThrow("Invalid refresh token response.");
    return buildAccessToken(payload.access_token, payload.expires_in);
  }

  async getSsoBindings(): Promise<SsoBinding[]> {
    // Fetch all SSO bindings for the current user using an internally resolved token.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      const response = await getApiV1AuthSsoBindings({
        client      : this.client,
        headers,
        throwOnError: true,
      });
      const bindings = response.data?.data?.bindings ?? [];
      return bindings.map(mapDtoToSsoBinding);
    });
  }

  async addSsoBinding(provider: SsoProvider, oauthCode: string): Promise<void> {
    // Add a new SSO binding using OAuth code with an internally resolved token.
    const normalized = oauthCode?.trim();
    const providerLabel = provider === "github" ? "GitHub" : "Google";
    if (!normalized) logAndThrow(`${providerLabel} OAuth code is required to add SSO binding.`);
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      await putApiV1AuthSsoByProvider({
        client      : this.client,
        headers,
        path        : { provider },
        body        : { oauth_code: normalized },
        throwOnError: true,
      });
    });
  }

  async deleteSsoBinding(provider: SsoProvider): Promise<void> {
    // Remove an existing SSO binding by provider using an internally resolved token.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      await deleteApiV1AuthSsoBindings({
        client      : this.client,
        headers,
        body        : { provider },
        throwOnError: true,
      });
    });
  }

  async getPasskeyChallenge(): Promise<PasskeyCreationOptions> {
    // Fetch passkey registration challenge using an internally resolved token.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      const response = await postApiV1AuthPasskeyRegisterChallenge({
        client      : this.client,
        headers,
        throwOnError: true,
      });
      const publicKey = response.data?.data?.publicKey;
      if (!publicKey) logAndThrow("Invalid passkey challenge response.");
      return mapDtoToPasskeyCreationOptions(publicKey);
    });
  }

  async verifyPasskey(credential: PasskeyRegisterRequest): Promise<void> {
    // Verify passkey registration using an internally resolved token.
    if (!credential) logAndThrow("Passkey credential is required.");
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      await postApiV1AuthPasskeyRegisterVerify({
        client      : this.client,
        headers,
        body        : credential,
        throwOnError: true,
      });
    });
  }

  async getPasskeyLoginChallenge(): Promise<PasskeyRequestOptions> {
    // Fetch passkey login challenge without access token (used before authentication).
    const response = await postApiV1AuthPasskeyLoginChallenge({
      client      : this.client,
      throwOnError: true,
    });
    const publicKey = response.data?.data?.publicKey;
    if (!publicKey) logAndThrow("Invalid passkey login challenge response.");
    return mapDtoToPasskeyRequestOptions(publicKey);
  }

  async verifyPasskeyLogin(credential: PasskeyLoginRequest): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }> {
    // Verify passkey login credential and exchange for tokens (no access token required).
    if (!credential) logAndThrow("Passkey login credential is required.");
    const response = await postApiV1AuthPasskeyLoginVerify({
      client             : this.client,
      body               : credential,
      throwOnError       : true,
      responseTransformer: postApiV1AuthPasskeyLoginVerifyResponseTransformer,
    });
    const payload = response.data?.data;
    if (!payload?.access_token || !payload.refresh_token) logAndThrow("Invalid passkey login response.");
    return {
      accessToken : buildAccessToken(payload.access_token, payload.expires_in),
      refreshToken: buildRefreshToken(payload.refresh_token, payload.refresh_token_expires_in),
    };
  }

  async getPasskeys(): Promise<Passkey[]> {
    // Fetch all registered passkeys using an internally resolved token.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      const response = await getApiV1AuthPasskeys({
        client      : this.client,
        headers,
        throwOnError: true,
      });
      const passkeys = response.data?.data?.passkeys ?? [];
      return passkeys.map(mapDtoToPasskey);
    });
  }

  async deletePasskey(passkeyId: number | bigint | string): Promise<void> {
    // Delete a registered passkey using an internally resolved token.
    const normalized = normalizePasskeyId(passkeyId);
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      await deleteApiV1AuthPasskeysByPasskeyId({
        client      : this.client,
        headers,
        path        : { passkey_id: normalized },
        throwOnError: true,
      });
    });
  }

  async get2FaList(): Promise<TwoFaInfo[]> {
    // Fetch all enabled 2FA methods using an internally resolved token.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      const response = await getApiV1Auth2Fa({ client: this.client, headers, throwOnError: true });
      const list = response.data?.data?.two_fa_list ?? [];
      return list.map(mapDtoToTwoFaInfo);
    });
  }

  async get2FaTotpSetup(): Promise<TotpSetupInfo> {
    // Fetch TOTP setup info using an internally resolved token.
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      const response = await getApiV1Auth2FaTotp({ client: this.client, headers, throwOnError: true });
      const payload = response.data?.data;
      if (!payload?.secret || !payload.token) logAndThrow("Invalid TOTP setup response.");
      return { qrCode: payload.qr_code, secret: payload.secret, token: payload.token, url: payload.url };
    });
  }

  async add2FaTotp(token: string, code: string): Promise<string> {
    // Verify TOTP code and enable 2FA using an internally resolved token. Returns recovery code.
    const trimmedToken = token?.trim();
    const trimmedCode = code?.trim();
    if (!trimmedToken || !trimmedCode) logAndThrow("Token and code are required to add TOTP 2FA.");
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      const response = await postApiV1Auth2FaTotp({
        client      : this.client,
        headers,
        body        : { token: trimmedToken, code: trimmedCode },
        throwOnError: true,
      });
      const recoveryCode = response.data?.data?.recovery_code;
      if (!recoveryCode) logAndThrow("Invalid TOTP setup response: missing recovery code.");
      return recoveryCode;
    });
  }

  async delete2Fa(type: TwoFaType, code: string): Promise<void> {
    // Delete a 2FA method by type using an internally resolved token. Requires TOTP code for verification.
    const trimmedCode = code?.trim();
    if (!trimmedCode) logAndThrow("TOTP code is required to delete 2FA.");
    return this.requireAuthHelper().executeWithAccessToken(async (headers) => {
      await deleteApiV1Auth2Fa({ client: this.client, headers, body: { type, code: trimmedCode }, throwOnError: true });
    });
  }

  async loginWith2Fa(token: string, code: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }> {
    // Complete login with 2FA verification (no access token required).
    const trimmedToken = token?.trim();
    const trimmedCode = code?.trim();
    if (!trimmedToken || !trimmedCode) logAndThrow("Token and code are required for 2FA login.");
    const response = await postApiV1Auth2FaLogin({
      client      : this.client,
      body        : { token: trimmedToken, code: trimmedCode },
      throwOnError: true,
    });
    const payload = response.data?.data;
    if (!payload?.access_token || !payload.refresh_token) logAndThrow("Invalid 2FA login response.");
    return {
      accessToken : { accessToken: payload.access_token, accessTokenExpiresAt: new Date(Date.now() + 3600000) },
      refreshToken: { refreshToken: payload.refresh_token, refreshTokenExpiresAt: new Date(Date.now() + 86400000 * 7) },
    };
  }

  async recover2Fa(token: string, recoveryCode: string): Promise<void> {
    // Remove 2FA using recovery code (no access token required).
    const trimmedToken = token?.trim();
    const trimmedCode = recoveryCode?.trim();
    if (!trimmedToken || !trimmedCode) logAndThrow("Token and recovery code are required for 2FA recovery.");
    await postApiV1Auth2FaRecovery({
      client      : this.client,
      body        : { token: trimmedToken, recovery_code: trimmedCode },
      throwOnError: true,
    });
  }

  private requireAuthHelper(): IAuthHelper {
    // Ensure authenticated operations are only used after auth helper injection.
    if (!this.authHelper) logAndThrow("Auth helper is required for authenticated auth requests.");
    return this.authHelper;
  }
}

function buildAccessToken(token: string, expiresAt: Date): AccessToken {
  if (!(expiresAt instanceof Date)) logAndThrow("Invalid access token expiration time.");
  return { accessToken: token, accessTokenExpiresAt: new Date(expiresAt.getTime()) };
}

function buildRefreshToken(token: string, expiresAt: Date): RefreshToken {
  if (!(expiresAt instanceof Date)) logAndThrow("Invalid refresh token expiration time.");
  return { refreshToken: token, refreshTokenExpiresAt: new Date(expiresAt.getTime()) };
}

function mapDtoToSsoBinding(dto: { provider: string; provider_user_id: string; provider_username: string; provider_email: string; created_at: string }): SsoBinding {
  return {
    provider        : dto.provider as SsoProvider,
    providerUserId  : dto.provider_user_id,
    providerUsername: dto.provider_username,
    providerEmail   : dto.provider_email,
    createdAt       : new Date(dto.created_at),
  };
}

function mapDtoToPasskey(dto: { id: number; credential_id: string; device_name: string; last_used_at: string }): Passkey {
  return {
    id          : dto.id,
    credentialId: dto.credential_id,
    deviceName  : dto.device_name,
    lastUsedAt  : new Date(dto.last_used_at),
  };
}

function mapDtoToTwoFaInfo(dto: { type: string; enabled: boolean; created_at: string }): TwoFaInfo {
  return { type: dto.type as TwoFaType, enabled: dto.enabled, createdAt: new Date(dto.created_at) };
}

function normalizePasskeyId(passkeyId: number | bigint | string): bigint {
  const raw = typeof passkeyId === "string" ? passkeyId.trim() : passkeyId;
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return BigInt(Math.trunc(raw));
  if (typeof raw === "string" && raw) return BigInt(raw);
  logAndThrow("Passkey id is required.");
}

function mapDtoToPasskeyCreationOptions(dto: {
  attestation            : string;
  authenticatorSelection?: { authenticatorAttachment?: string; requireResidentKey?: boolean; residentKey?: string; userVerification?: string };
  challenge              : string;
  excludeCredentials?    : Array<{ id: string; transports?: string[]; type: string }>;
  pubKeyCredParams       : Array<{ alg: number; type: string }>;
  rp                     : { id: string; name: string };
  timeout                : number;
  user                   : { displayName: string; id: string; name: string };
}): PasskeyCreationOptions {
  return {
    attestation           : dto.attestation,
    authenticatorSelection: dto.authenticatorSelection,
    challenge             : dto.challenge,
    excludeCredentials    : dto.excludeCredentials,
    pubKeyCredParams      : dto.pubKeyCredParams,
    rp                    : dto.rp,
    timeout               : dto.timeout,
    user                  : dto.user,
  };
}

function mapDtoToPasskeyRequestOptions(dto: {
  allowCredentials?: Array<{ id: string; transports?: string[]; type: string }>;
  challenge        : string;
  rpId             : string;
  timeout          : number;
  userVerification?: string;
}): PasskeyRequestOptions {
  return {
    allowCredentials: dto.allowCredentials,
    challenge       : dto.challenge,
    rpId            : dto.rpId,
    timeout         : dto.timeout,
    userVerification: dto.userVerification,
  };
}

export const authRepository: IAuthRepository = new HttpAuthRepository();
