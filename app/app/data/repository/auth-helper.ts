import type { AccessToken, IAuthRepository, Passkey, PasskeyCreationOptions, PasskeyLoginRequest, PasskeyRegisterRequest, PasskeyRequestOptions, RefreshToken, SsoBinding, SsoProvider, TotpSetupInfo, TwoFaInfo, TwoFaType } from "../interface/i-auth-repository";
import type { AuthorizationHeaders, IAuthHelper } from "../interface/i-auth-helper";
import type { ITokenLocalStorageRepository } from "../interface/i-token-local-storage-repository";
import { ErrorHandler } from "~/error/error-checker";

export class AuthHelper implements IAuthHelper {
  constructor(
    private authRepository: IAuthRepository,
    private tokenRepository: ITokenLocalStorageRepository
  ) {
  }

  public getMode(): "logined" | "local" {
    const refreshToken = this.tokenRepository.getRefreshToken();
    if (refreshToken){
      return "logined";
    }else{
      return "local";
    }
  }
  public async newAccessToken(): Promise<AccessToken> {
    const refreshToken = await this.mustGetRefreshToken();

    const accessToken = await this.authRepository.updateAccessToken(refreshToken.refreshToken);
    this.tokenRepository.saveAccessToken(accessToken);
    return accessToken;
  }

  public async validateAccessToken(accessToken: AccessToken): Promise<boolean> {
    // check the access token expiration date
    // for safety, consider token expired 20s before actual expiration
    const isValid = (accessToken.accessTokenExpiresAt.getTime() - 20000) > Date.now();
    return isValid;
  }

  public async requireAccessToken(): Promise<AccessToken>{
    const executor = async () => {
      let accessToken = this.tokenRepository.getAccessToken();
      if (!accessToken){
        console.log("No access token found, getting a new one using refresh token.");
        accessToken  = await this.newAccessToken();
      }else{
        const isValid = await this.validateAccessToken(accessToken);
        if (!isValid){
          console.log("Access token expired or invalid, getting a new one using refresh token.");
          accessToken = await this.newAccessToken();
        }
      }
      return accessToken;
    };
    // if browser not support locks api, just execute directly
    if (typeof navigator === "undefined" || !navigator.locks?.request) return executor();
    // use locks api to avoid multiple concurrent token refresh
    return navigator.locks.request("get-auth-access-token", { mode: "exclusive" }, async () => executor());
  }

  public async mustGetRefreshToken(): Promise<RefreshToken>{
    const refreshToken = this.tokenRepository.getRefreshToken();
    if (!refreshToken){
      console.log("must get refresh token fail: No refresh token found");
      throw new Error("Logout: No refresh token found");
    }
    return refreshToken;
  }




  public async executeWithAccessToken<T>(operation: (headers: AuthorizationHeaders) => Promise<T>, retryCount = 1): Promise<T> {
    let attempt = 0;
    while (attempt <= retryCount) {
      try {
        const token = await this.requireAccessToken();
        return await operation(this.buildAuthHeaders(token.accessToken));
      } catch (error) {
        // if (ErrorHandler.isInvalidRefreshToken(error)) {
        //   console.error("Refresh token is invalid during executeWithAccessToken, logging out.");
        //   throw new Error("Logout: Invalid refresh token. It seems your session has been invalid/expired. You are forced to logout.");
        // };
        if (attempt === retryCount) {
          console.error("Exceeded maximum retry attempts for executeWithAccessToken.");
          throw error;
        };
        if (ErrorHandler.isInvalidAccessToken(error)) {
          console.error("Access token invalid during executeWithAccessToken. try to retry", error);
          await this.newAccessToken();
        };
        attempt += 1;
        console.warn(`make API call with access token failed, retrying to get a new one (attempt ${attempt} of ${retryCount})`);
      }
    }
    throw new Error(`make API call with access token failed after ${retryCount} retries`);
  }

  private buildAuthHeaders(token: string): AuthorizationHeaders {
    const resolved = token?.trim();
    if (!resolved) {
      console.error("Missing access token for Tool API requests.");
      throw new Error("Missing access token for Tool API requests.");
    }
    const authorization = resolved.toLowerCase().startsWith("bearer ") ? resolved : `Bearer ${resolved}`;
    return { Authorization: authorization };
  }
  public async logout(): Promise<void> {
    // Delegate access token resolution to repository to keep logout flow centralized.
    await this.authRepository.logout();
    this.tokenRepository.clear();
  }

  public forceLogout(): void {
    this.tokenRepository.clear();
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    try {
      window.localStorage.clear();
    } catch (error) {
      console.error("Failed to clear local storage during force logout.", error);
    }
  }

  public async login(username: string, password: string): Promise<void> {
    const { accessToken, refreshToken } = await this.authRepository.login(username, password);
    this.tokenRepository.saveAccessToken(accessToken);
    this.tokenRepository.saveRefreshToken(refreshToken);
  }

  public async loginWithSso(provider: SsoProvider, oauthCode: string): Promise<void> {
    // Persist tokens returned by SSO exchange using specified provider.
    const { accessToken, refreshToken } = await this.authRepository.loginWithSso(provider, oauthCode);
    this.tokenRepository.saveAccessToken(accessToken);
    this.tokenRepository.saveRefreshToken(refreshToken);
  }

  public async getSsoBindings(): Promise<SsoBinding[]> {
    // Repository resolves access token internally for SSO bindings.
    return this.authRepository.getSsoBindings();
  }

  public async addSsoBinding(provider: SsoProvider, oauthCode: string): Promise<void> {
    // Repository resolves access token internally for SSO updates.
    return this.authRepository.addSsoBinding(provider, oauthCode);
  }

  public async deleteSsoBinding(provider: SsoProvider): Promise<void> {
    // Repository resolves access token internally for SSO updates.
    return this.authRepository.deleteSsoBinding(provider);
  }

  public async getPasskeyChallenge(): Promise<PasskeyCreationOptions> {
    // Repository resolves access token internally for passkey operations.
    return this.authRepository.getPasskeyChallenge();
  }

  public async verifyPasskey(credential: PasskeyRegisterRequest): Promise<void> {
    // Repository resolves access token internally for passkey operations.
    return this.authRepository.verifyPasskey(credential);
  }

  public async getPasskeyLoginChallenge(): Promise<PasskeyRequestOptions> {
    // No access token required for login challenge (used before authentication).
    return this.authRepository.getPasskeyLoginChallenge();
  }

  public async loginWithPasskey(credential: PasskeyLoginRequest): Promise<void> {
    // Verify passkey credential and persist tokens (no access token required).
    const { accessToken, refreshToken } = await this.authRepository.verifyPasskeyLogin(credential);
    this.tokenRepository.saveAccessToken(accessToken);
    this.tokenRepository.saveRefreshToken(refreshToken);
  }

  public async getPasskeys(): Promise<Passkey[]> {
    // Repository resolves access token internally for passkey operations.
    return this.authRepository.getPasskeys();
  }

  public async deletePasskey(passkeyId: number | bigint | string): Promise<void> {
    // Repository resolves access token internally for passkey operations.
    return this.authRepository.deletePasskey(passkeyId);
  }

  public async get2FaList(): Promise<TwoFaInfo[]> {
    // Repository resolves access token internally for 2FA operations.
    return this.authRepository.get2FaList();
  }

  public async get2FaTotpSetup(): Promise<TotpSetupInfo> {
    // Repository resolves access token internally for 2FA operations.
    return this.authRepository.get2FaTotpSetup();
  }

  public async add2FaTotp(token: string, code: string): Promise<string> {
    // Repository resolves access token internally for 2FA operations. Returns recovery code.
    return this.authRepository.add2FaTotp(token, code);
  }

  public async delete2Fa(type: TwoFaType, code: string): Promise<void> {
    // Repository resolves access token internally for 2FA operations. Requires TOTP code for verification.
    return this.authRepository.delete2Fa(type, code);
  }

  public async loginWith2Fa(token: string, code: string): Promise<void> {
    // Complete login with 2FA verification and persist tokens.
    const { accessToken, refreshToken } = await this.authRepository.loginWith2Fa(token, code);
    this.tokenRepository.saveAccessToken(accessToken);
    this.tokenRepository.saveRefreshToken(refreshToken);
  }

  public async recover2Fa(token: string, recoveryCode: string): Promise<void> {
    // Remove 2FA using recovery code (no access token required).
    await this.authRepository.recover2Fa(token, recoveryCode);
  }
}
