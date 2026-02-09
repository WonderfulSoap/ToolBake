import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthHelper } from "./auth-helper";
import type { AccessToken, IAuthRepository, RefreshToken } from "../interface/i-auth-repository";
import type { ITokenLocalStorageRepository } from "../interface/i-token-local-storage-repository";
import { ApiError } from "../http-client/api-error";

type AuthRepositoryStub = IAuthRepository & {
  // Include methods to satisfy the repository interface in tests.
  login                  : ReturnType<typeof vi.fn<IAuthRepository["login"]>>;
  loginWithSso           : ReturnType<typeof vi.fn<IAuthRepository["loginWithSso"]>>;
  logout                 : ReturnType<typeof vi.fn<IAuthRepository["logout"]>>;
  updateAccessToken      : ReturnType<typeof vi.fn<IAuthRepository["updateAccessToken"]>>;
  getSsoBindings         : ReturnType<typeof vi.fn<IAuthRepository["getSsoBindings"]>>;
  addSsoBinding          : ReturnType<typeof vi.fn<IAuthRepository["addSsoBinding"]>>;
  deleteSsoBinding       : ReturnType<typeof vi.fn<IAuthRepository["deleteSsoBinding"]>>;
  getPasskeyChallenge    : ReturnType<typeof vi.fn<IAuthRepository["getPasskeyChallenge"]>>;
  verifyPasskey          : ReturnType<typeof vi.fn<IAuthRepository["verifyPasskey"]>>;
  getPasskeyLoginChallenge: ReturnType<typeof vi.fn<IAuthRepository["getPasskeyLoginChallenge"]>>;
  verifyPasskeyLogin     : ReturnType<typeof vi.fn<IAuthRepository["verifyPasskeyLogin"]>>;
  getPasskeys            : ReturnType<typeof vi.fn<IAuthRepository["getPasskeys"]>>;
  deletePasskey          : ReturnType<typeof vi.fn<IAuthRepository["deletePasskey"]>>;
  get2FaList             : ReturnType<typeof vi.fn<IAuthRepository["get2FaList"]>>;
  get2FaTotpSetup        : ReturnType<typeof vi.fn<IAuthRepository["get2FaTotpSetup"]>>;
  add2FaTotp             : ReturnType<typeof vi.fn<IAuthRepository["add2FaTotp"]>>;
  delete2Fa              : ReturnType<typeof vi.fn<IAuthRepository["delete2Fa"]>>;
  loginWith2Fa           : ReturnType<typeof vi.fn<IAuthRepository["loginWith2Fa"]>>;
};

type TokenRepositoryStub = ITokenLocalStorageRepository & {
  getAccessToken  : ReturnType<typeof vi.fn<ITokenLocalStorageRepository["getAccessToken"]>>;
  saveAccessToken : ReturnType<typeof vi.fn<ITokenLocalStorageRepository["saveAccessToken"]>>;
  getRefreshToken : ReturnType<typeof vi.fn<ITokenLocalStorageRepository["getRefreshToken"]>>;
  saveRefreshToken: ReturnType<typeof vi.fn<ITokenLocalStorageRepository["saveRefreshToken"]>>;
  clear           : ReturnType<typeof vi.fn<ITokenLocalStorageRepository["clear"]>>;
};

function createAccessToken(value: string): AccessToken {
  return { accessToken: value, accessTokenExpiresAt: new Date(Date.now() + 60_000) };
}

function createRefreshToken(value: string): RefreshToken {
  return { refreshToken: value, refreshTokenExpiresAt: new Date(Date.now() + 120_000) };
}

function createAuthRepository(newToken: AccessToken): AuthRepositoryStub {
  return {
    login                  : vi.fn<IAuthRepository["login"]>(),
    loginWithSso           : vi.fn<IAuthRepository["loginWithSso"]>(),
    logout                 : vi.fn<IAuthRepository["logout"]>(async () => {}),
    updateAccessToken      : vi.fn<IAuthRepository["updateAccessToken"]>(async () => newToken),
    getSsoBindings         : vi.fn<IAuthRepository["getSsoBindings"]>(async () => []),
    addSsoBinding          : vi.fn<IAuthRepository["addSsoBinding"]>(async () => {}),
    deleteSsoBinding       : vi.fn<IAuthRepository["deleteSsoBinding"]>(async () => {}),
    getPasskeyChallenge    : vi.fn<IAuthRepository["getPasskeyChallenge"]>(),
    verifyPasskey          : vi.fn<IAuthRepository["verifyPasskey"]>(),
    getPasskeyLoginChallenge: vi.fn<IAuthRepository["getPasskeyLoginChallenge"]>(),
    verifyPasskeyLogin     : vi.fn<IAuthRepository["verifyPasskeyLogin"]>(),
    getPasskeys            : vi.fn<IAuthRepository["getPasskeys"]>(async () => []),
    deletePasskey          : vi.fn<IAuthRepository["deletePasskey"]>(async () => {}),
    get2FaList             : vi.fn<IAuthRepository["get2FaList"]>(async () => []),
    get2FaTotpSetup        : vi.fn<IAuthRepository["get2FaTotpSetup"]>(),
    add2FaTotp             : vi.fn<IAuthRepository["add2FaTotp"]>(async () => {}),
    delete2Fa              : vi.fn<IAuthRepository["delete2Fa"]>(async () => {}),
    loginWith2Fa           : vi.fn<IAuthRepository["loginWith2Fa"]>(),
  };
}

function createTokenRepository(options: { accessToken?: AccessToken; refreshToken?: RefreshToken }): TokenRepositoryStub {
  let storedAccessToken = options.accessToken;
  let storedRefreshToken = options.refreshToken;
  return {
    getAccessToken : vi.fn<ITokenLocalStorageRepository["getAccessToken"]>(() => storedAccessToken),
    saveAccessToken: vi.fn<ITokenLocalStorageRepository["saveAccessToken"]>((token) => {
      storedAccessToken = token;
    }),
    getRefreshToken : vi.fn<ITokenLocalStorageRepository["getRefreshToken"]>(() => storedRefreshToken),
    saveRefreshToken: vi.fn<ITokenLocalStorageRepository["saveRefreshToken"]>((token) => {
      storedRefreshToken = token ?? undefined;
    }),
    clear: vi.fn<ITokenLocalStorageRepository["clear"]>(() => {
      storedAccessToken = undefined;
      storedRefreshToken = undefined;
    }),
  };
}

describe("AuthHelper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("executeWithAccessToken resolves with cached token when operation succeeds", async () => {
    const cachedToken = createAccessToken("cached");
    const refreshToken = createRefreshToken("refresh-1");
    const authRepository = createAuthRepository(createAccessToken("unused"));
    const tokenRepository = createTokenRepository({ accessToken: cachedToken, refreshToken });
    const helper = new AuthHelper(authRepository, tokenRepository);
    const result = await helper.executeWithAccessToken(async (headers) => {
      expect(headers.Authorization).toBe("Bearer cached");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(authRepository.updateAccessToken).not.toHaveBeenCalled();
  });

  it("executeWithAccessToken retries on InvalidAccessToken and eventually throws after max retries", async () => {
    const cachedToken = createAccessToken("cached-token");
    const refreshedToken = createAccessToken("refreshed-token");
    const refreshToken = createRefreshToken("refresh-token");
    const authRepository = createAuthRepository(refreshedToken);
    const tokenRepository = createTokenRepository({ accessToken: cachedToken, refreshToken });
    const helper = new AuthHelper(authRepository, tokenRepository);
    let attempts = 0;
    // The implementation retries on any error, so InvalidAccessToken will cause retry
    // After retryCount (1) retries exceeded, it throws the original error
    await expect(
      helper.executeWithAccessToken(async (headers) => {
        attempts += 1;
        expect(headers.Authorization).toBe("Bearer cached-token");
        throw new ApiError("expired", { code: "InvalidAccessToken" });
      }),
    ).rejects.toThrow("expired");
    expect(attempts).toBe(2); // initial + 1 retry
  });

  it("executeWithAccessToken retries on any error and throws after max retries", async () => {
    const cachedToken = createAccessToken("cached-token");
    const refreshToken = createRefreshToken("refresh-token");
    const authRepository = createAuthRepository(createAccessToken("refreshed-token"));
    const tokenRepository = createTokenRepository({ accessToken: cachedToken, refreshToken });
    const helper = new AuthHelper(authRepository, tokenRepository);
    let attempts = 0;
    // The implementation retries on any error (not just InvalidAccessToken)
    await expect(
      helper.executeWithAccessToken(async () => {
        attempts += 1;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(attempts).toBe(2); // initial + 1 retry
  });

  it("executeWithAccessToken throws logout error when refresh token is invalid", async () => {
    const refreshToken = createRefreshToken("refresh-token");
    const authRepository: AuthRepositoryStub = {
      login                  : vi.fn(),
      loginWithSso           : vi.fn(),
      logout                 : vi.fn(async () => {}),
      updateAccessToken      : vi.fn(async () => {
        throw new ApiError("invalid refresh", { code: "InvalidRefreshToken" });
      }),
      getSsoBindings         : vi.fn(async () => []),
      addSsoBinding          : vi.fn(async () => {}),
      deleteSsoBinding       : vi.fn(async () => {}),
      getPasskeyChallenge    : vi.fn(),
      verifyPasskey          : vi.fn(),
      getPasskeyLoginChallenge: vi.fn(),
      verifyPasskeyLogin     : vi.fn(),
      getPasskeys            : vi.fn(),
      deletePasskey          : vi.fn(),
      get2FaList             : vi.fn(async () => []),
      get2FaTotpSetup        : vi.fn(),
      add2FaTotp             : vi.fn(async () => {}),
      delete2Fa              : vi.fn(async () => {}),
      loginWith2Fa           : vi.fn(),
    };
    const tokenRepository = createTokenRepository({ refreshToken });
    const helper = new AuthHelper(authRepository, tokenRepository);
    await expect(helper.executeWithAccessToken(async () => "ok")).rejects.toThrow("Logout: Invalid refresh token");
    expect(authRepository.updateAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenRepository.saveAccessToken).not.toHaveBeenCalled();
  });

  it("forceLogout clears tokens and local storage", () => {
    const authRepository = createAuthRepository(createAccessToken("token"));
    const tokenRepository = createTokenRepository({ accessToken: createAccessToken("access"), refreshToken: createRefreshToken("refresh") });
    const helper = new AuthHelper(authRepository, tokenRepository);
    const clearSpy = vi.fn();
    vi.stubGlobal("window", { localStorage: { clear: clearSpy } } as unknown as Window);
    helper.forceLogout();
    expect(tokenRepository.clear).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
