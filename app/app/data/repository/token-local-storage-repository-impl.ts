import type { AccessToken, RefreshToken } from "../interface/i-auth-repository";
import type { ITokenLocalStorageRepository } from "../interface/i-token-local-storage-repository";
import { z } from "zod";

export const ACCESS_TOKEN_STORAGE_KEY = "toolbake.auth.accessToken";
export const REFRESH_TOKEN_STORAGE_KEY = "toolbake.auth.refreshToken";

const storedAccessTokenSchema = z.object({
  accessToken         : z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime().transform((value) => new Date(value)),
});
type StoredAccessToken = z.infer<typeof storedAccessTokenSchema>;

const storedRefreshTokenSchema = z.object({
  refreshToken         : z.string().min(1),
  refreshTokenExpiresAt: z.iso.datetime().transform((value) => new Date(value)),
});
type StoredRefreshToken = z.infer<typeof storedRefreshTokenSchema>;


export class TokenLocalStorageRepository implements ITokenLocalStorageRepository {
  private readonly accessTokenStorageKey = ACCESS_TOKEN_STORAGE_KEY;
  private readonly refreshTokenStorageKey = REFRESH_TOKEN_STORAGE_KEY;

  getAccessToken(): AccessToken | undefined {
    const stored = this.readStoredItem(this.accessTokenStorageKey);
    if (stored === undefined) return undefined;
    const parsed = this.parseAccessToken(stored);
    if (!parsed) {
      this.removeStoredItem(this.accessTokenStorageKey, "Failed to remove invalid access token");
      return undefined;
    }
    return parsed;
  }

  saveAccessToken(token: AccessToken): void {
    const payload: StoredAccessToken = {
      accessToken         : token.accessToken,
      accessTokenExpiresAt: new Date(token.accessTokenExpiresAt.getTime()),
    };
    this.persistItem(this.accessTokenStorageKey, JSON.stringify(payload), "Failed to persist access token");
  }

  getRefreshToken(): RefreshToken | undefined {
    const stored = this.readStoredItem(this.refreshTokenStorageKey);
    if (stored === undefined) return undefined;
    const parsed = this.parseRefreshToken(stored);
    if (!parsed) {
      this.removeStoredItem(this.refreshTokenStorageKey, "Failed to remove invalid refresh token");
      return undefined;
    }
    return parsed;
  }

  saveRefreshToken(token: RefreshToken | null): void {
    if (!token) {
      this.removeStoredItem(this.refreshTokenStorageKey, "Failed to remove stored refresh token");
      return;
    }
    const payload: StoredRefreshToken = {
      refreshToken         : token.refreshToken,
      refreshTokenExpiresAt: new Date(token.refreshTokenExpiresAt.getTime()),
    };
    this.persistItem(this.refreshTokenStorageKey, JSON.stringify(payload), "Failed to persist refresh token");
  }

  clear(): void {
    this.removeStoredItem(this.accessTokenStorageKey, "Failed to remove stored access token");
    this.removeStoredItem(this.refreshTokenStorageKey, "Failed to remove stored refresh token");
  }

  private readStoredItem(key: string): string | undefined {
    const storage = this.resolveStorage();
    if (!storage) return undefined;
    try {
      const stored = storage.getItem(key);
      return stored === null ? undefined : stored;
    } catch (error) {
      console.error(`Failed to read stored token (${key})`, error);
      return undefined;
    }
  }

  private parseAccessToken(raw: string): AccessToken | undefined {
    try {
      const parsed = JSON.parse(raw);
      const result = storedAccessTokenSchema.safeParse(parsed);
      if (!result.success) {
        console.error("Failed to parse stored access token", result.error);
        return undefined;
      }
      return result.data;
    } catch (error) {
      console.error("Failed to parse stored access token", error);
      return undefined;
    }
  }

  private parseRefreshToken(raw: string): RefreshToken | undefined {
    try {
      const parsed = JSON.parse(raw);
      const result = storedRefreshTokenSchema.safeParse(parsed);
      if (!result.success) {
        console.error("Failed to parse stored refresh token", result.error);
        return undefined;
      }
      return result.data;
    } catch (error) {
      console.error("Failed to parse stored refresh token", error);
      return undefined;
    }
  }

  private persistItem(key: string, value: string, errorMessage: string): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch (error) {
      console.error(errorMessage, error);
    }
  }

  private removeStoredItem(key: string, errorMessage: string): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (error) {
      console.error(errorMessage, error);
    }
  }

  private resolveStorage(): Storage | null {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
    return window.localStorage;
  }
}
