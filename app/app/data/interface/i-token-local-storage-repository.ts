import type { AccessToken, RefreshToken } from "./i-auth-repository";

export interface ITokenLocalStorageRepository {
  getAccessToken(): AccessToken | undefined;
  saveAccessToken(token: AccessToken): void;
  getRefreshToken(): RefreshToken | undefined;
  saveRefreshToken(token: RefreshToken | null): void;
  clear(): void;
}
