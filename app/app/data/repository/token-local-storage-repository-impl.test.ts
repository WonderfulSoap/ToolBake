import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenLocalStorageRepository, ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from "./token-local-storage-repository-impl";
import type { AccessToken, RefreshToken } from "../interface/i-auth-repository";

class MockLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("TokenLocalStorageRepository", () => {
  let repository: TokenLocalStorageRepository;
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    const mockWindow = { localStorage: mockStorage } as unknown as Window & typeof globalThis;
    vi.stubGlobal("window", mockWindow);
    repository = new TokenLocalStorageRepository();
  });

  it("returns undefined when access token is not stored", () => {
    expect(repository.getAccessToken()).toBeUndefined();
  });

  it("returns stored access token", () => {
    const token = buildAccessToken();
    seedAccessToken(token);
    const result = repository.getAccessToken();
    expect(result).toEqual(token);
  });

  it("removes invalid stored access token payload", () => {
    mockStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, "not-json");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    const result = repository.getAccessToken();
    expect(result).toBeUndefined();
    expect(mockStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("persists access token in localStorage", () => {
    const token = buildAccessToken();
    repository.saveAccessToken(token);
    const storedRaw = mockStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw ?? "{}") as { accessToken: string; accessTokenExpiresAt: string; };
    expect(stored.accessToken).toBe(token.accessToken);
    expect(stored.accessTokenExpiresAt).toBe(token.accessTokenExpiresAt.toISOString());
  });

  it("returns stored refresh token", () => {
    const token = buildRefreshToken();
    seedRefreshToken(token);
    const result = repository.getRefreshToken();
    expect(result).toEqual(token);
  });

  it("removes refresh token when saving null", () => {
    const token = buildRefreshToken();
    seedRefreshToken(token);
    repository.saveRefreshToken(null);
    expect(mockStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("persists refresh token payload", () => {
    const token = buildRefreshToken();
    repository.saveRefreshToken(token);
    const storedRaw = mockStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw ?? "{}") as { refreshToken: string; refreshTokenExpiresAt: string; };
    expect(stored.refreshToken).toBe(token.refreshToken);
    expect(stored.refreshTokenExpiresAt).toBe(token.refreshTokenExpiresAt.toISOString());
  });

  it("clear removes both stored tokens", () => {
    seedAccessToken(buildAccessToken());
    seedRefreshToken(buildRefreshToken());
    repository.clear();
    expect(mockStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(mockStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  function seedAccessToken(token: AccessToken): void {
    mockStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken         : token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt.toISOString(),
    }));
  }

  function seedRefreshToken(token: RefreshToken): void {
    mockStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, JSON.stringify({
      refreshToken         : token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt.toISOString(),
    }));
  }
});

function buildAccessToken(): AccessToken {
  return {
    accessToken         : "access-token",
    accessTokenExpiresAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

function buildRefreshToken(): RefreshToken {
  return {
    refreshToken         : "refresh-token",
    refreshTokenExpiresAt: new Date("2025-02-02T03:04:05.000Z"),
  };
}
