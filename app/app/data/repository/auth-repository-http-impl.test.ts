import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HttpAuthRepository } from "./auth-repository-http-impl";
import { ApiError, HttpClient } from "~/data/http-client/http-client";
import type { IAuthHelper } from "~/data/interface/i-auth-helper";

const server = setupServer();
const baseUrl = "https://api.test.local";

function createRepository(authHelper?: Pick<IAuthHelper, "executeWithAccessToken">): HttpAuthRepository {
  const repository = new HttpAuthRepository(new HttpClient({ baseUrl }));
  if (authHelper) repository.setAuthHelper(authHelper as IAuthHelper);
  return repository;
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

describe("HttpAuthRepository", () => {
  describe("login", () => {
    it("returns access and refresh tokens when payload is valid", async () => {
      const accessExpiresAt = new Date("2025-01-02T03:04:05.000Z");
      const refreshExpiresAt = new Date("2025-01-10T11:12:13.000Z");
      server.use(
        http.post("*/auth/login", async ({ request }) => {
          const body = (await request.json()) as { username: string; password: string; };
          expect(body).toEqual({ username: "demo-user", password: "secret-pass" });
          return HttpResponse.json({
            data: {
              access_token            : "access-token-value",
              expires_in              : accessExpiresAt.toISOString(),
              refresh_token           : "refresh-token-value",
              refresh_token_expires_in: refreshExpiresAt.toISOString(),
            },
            message   : "success",
            request_id: "req-1",
            status    : "ok",
          });
        }),
      );
      const repository = createRepository();
      const result = await repository.login("demo-user", "secret-pass");
      expect(result.accessToken.accessToken).toBe("access-token-value");
      expect(result.accessToken.accessTokenExpiresAt.getTime()).toBe(accessExpiresAt.getTime());
      expect(result.refreshToken.refreshToken).toBe("refresh-token-value");
      expect(result.refreshToken.refreshTokenExpiresAt.getTime()).toBe(refreshExpiresAt.getTime());
    });

    it("throws when backend payload is missing required fields", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(
        http.post("*/auth/login", () =>
          HttpResponse.json({
            data: {
              expires_in              : new Date().toISOString(),
              refresh_token_expires_in: new Date().toISOString(),
            },
            message   : "invalid",
            request_id: "req-2",
            status    : "error",
          }),
        ),
      );
      const repository = createRepository();
      await expect(repository.login("demo", "pw")).rejects.toThrow("Invalid login response.");
      expect(consoleSpy).toHaveBeenCalledWith("Invalid login response.");
    });

    it("propagates ApiError when backend returns InvalidCredentials", async () => {
      server.use(
        http.post("*/auth/login", () =>
          HttpResponse.json(
            {
              error_code: "InvalidCredentials",
              message   : "Invalid credentials",
              request_id: "req-err",
              status    : "error",
            },
            { status: 400 },
          ),
        ),
      );
      const repository = createRepository();
      await expect(async () => {
        try {
          await repository.login("demo", "bad-pass");
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).code).toBe("InvalidCredentials");
          throw error;
        }
      }).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("loginWithSso", () => {
    it("returns access and refresh tokens for GitHub provider", async () => {
      const accessExpiresAt = new Date("2025-03-01T01:02:03.000Z");
      const refreshExpiresAt = new Date("2025-03-05T11:12:13.000Z");
      server.use(
        http.post("*/auth/sso/github", async ({ request }) => {
          const body = (await request.json()) as { oauth_code: string; };
          expect(body).toEqual({ oauth_code: "github-code" });
          return HttpResponse.json({
            data: {
              access_token            : "github-access-token",
              expires_in              : accessExpiresAt.toISOString(),
              refresh_token           : "github-refresh-token",
              refresh_token_expires_in: refreshExpiresAt.toISOString(),
            },
            message   : "success",
            request_id: "req-github-1",
            status    : "ok",
          });
        }),
      );
      const repository = createRepository();
      const result = await repository.loginWithSso("github", "github-code");
      expect(result.accessToken.accessToken).toBe("github-access-token");
      expect(result.accessToken.accessTokenExpiresAt.getTime()).toBe(accessExpiresAt.getTime());
      expect(result.refreshToken.refreshToken).toBe("github-refresh-token");
      expect(result.refreshToken.refreshTokenExpiresAt.getTime()).toBe(refreshExpiresAt.getTime());
    });

    it("returns access and refresh tokens for Google provider", async () => {
      const accessExpiresAt = new Date("2025-03-01T01:02:03.000Z");
      const refreshExpiresAt = new Date("2025-03-05T11:12:13.000Z");
      server.use(
        http.post("*/auth/sso/google", async ({ request }) => {
          const body = (await request.json()) as { oauth_code: string; };
          expect(body).toEqual({ oauth_code: "google-code" });
          return HttpResponse.json({
            data: {
              access_token            : "google-access-token",
              expires_in              : accessExpiresAt.toISOString(),
              refresh_token           : "google-refresh-token",
              refresh_token_expires_in: refreshExpiresAt.toISOString(),
            },
            message   : "success",
            request_id: "req-google-1",
            status    : "ok",
          });
        }),
      );
      const repository = createRepository();
      const result = await repository.loginWithSso("google", "google-code");
      expect(result.accessToken.accessToken).toBe("google-access-token");
      expect(result.accessToken.accessTokenExpiresAt.getTime()).toBe(accessExpiresAt.getTime());
      expect(result.refreshToken.refreshToken).toBe("google-refresh-token");
      expect(result.refreshToken.refreshTokenExpiresAt.getTime()).toBe(refreshExpiresAt.getTime());
    });

    it("throws when OAuth code is missing for GitHub", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const repository = createRepository();
      await expect(repository.loginWithSso("github", "")).rejects.toThrow("GitHub OAuth code is required for SSO login.");
      expect(consoleSpy).toHaveBeenCalledWith("GitHub OAuth code is required for SSO login.");
    });

    it("throws when OAuth code is missing for Google", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const repository = createRepository();
      await expect(repository.loginWithSso("google", "")).rejects.toThrow("Google OAuth code is required for SSO login.");
      expect(consoleSpy).toHaveBeenCalledWith("Google OAuth code is required for SSO login.");
    });

    it("throws when backend payload is missing required fields", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(
        http.post("*/auth/sso/google", () =>
          HttpResponse.json({
            data: {
              expires_in              : new Date().toISOString(),
              refresh_token_expires_in: new Date().toISOString(),
            },
            message   : "invalid",
            request_id: "req-google-2",
            status    : "error",
          }),
        ),
      );
      const repository = createRepository();
      await expect(repository.loginWithSso("google", "google-code")).rejects.toThrow("Invalid Google SSO response.");
      expect(consoleSpy).toHaveBeenCalledWith("Invalid Google SSO response.");
    });
  });

  describe("logout", () => {
    it("sends bearer authorization header", async () => {
      const captured: string[] = [];
      server.use(
        http.post("*/auth/logout", async ({ request }) => {
          captured.push(request.headers.get("authorization") ?? "");
          return HttpResponse.json({
            data      : {},
            message   : "ok",
            request_id: "req-3",
            status    : "ok",
          });
        }),
      );
      const authHelper = {
        executeWithAccessToken: vi.fn(async (operation) => operation({ Authorization: "Bearer TOKEN-123" })),
      };
      const repository = createRepository(authHelper);
      await repository.logout();
      expect(captured[0]).toBe("Bearer TOKEN-123");
      expect(authHelper.executeWithAccessToken).toHaveBeenCalledTimes(1);
    });

    it("throws when auth helper is missing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const repository = createRepository();
      await expect(repository.logout()).rejects.toThrow("Auth helper is required for authenticated auth requests.");
      expect(consoleSpy).toHaveBeenCalledWith("Auth helper is required for authenticated auth requests.");
    });

    it("propagates ApiError with InvalidAccessToken when backend indicates expired access token", async () => {
      server.use(
        http.post("*/auth/logout", () =>
          HttpResponse.json(
            { error_code: "InvalidAccessToken", message: "access expired", request_id: "req-expire", status: "error" },
            { status: 401 },
          ),
        ),
      );
      const authHelper = {
        executeWithAccessToken: vi.fn(async (operation) => operation({ Authorization: "Bearer expired-token" })),
      };
      const repository = createRepository(authHelper);
      await expect(async () => {
        try {
          await repository.logout();
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).code).toBe("InvalidAccessToken");
          throw error;
        }
      }).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("updateAccessToken", () => {
    it("returns new access token", async () => {
      const accessExpiresAt = new Date("2026-06-01T00:00:00.000Z");
      server.use(
        http.post("*/auth/access-token", async ({ request }) => {
          const body = (await request.json()) as { refresh_token: string; };
          expect(body).toEqual({ refresh_token: "refresh-token" });
          return HttpResponse.json({
            data      : { access_token: "new-access-token", expires_in: accessExpiresAt.toISOString() },
            message   : "ok",
            request_id: "req-4",
            status    : "ok",
          });
        }),
      );
      const repository = createRepository();
      const token = await repository.updateAccessToken("refresh-token");
      expect(token.accessToken).toBe("new-access-token");
      expect(token.accessTokenExpiresAt.getTime()).toBe(accessExpiresAt.getTime());
    });

    it("throws when payload lacks token", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(
        http.post("*/auth/access-token", () =>
          HttpResponse.json({
            data      : {},
            message   : "bad",
            request_id: "req-5",
            status    : "error",
          }),
        ),
      );
      const repository = createRepository();
      await expect(repository.updateAccessToken("refresh-token")).rejects.toThrow("Invalid refresh token response.");
      expect(consoleSpy).toHaveBeenCalledWith("Invalid refresh token response.");
    });

    it("throws when refresh token is empty", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const repository = createRepository();
      await expect(repository.updateAccessToken("")).rejects.toThrow("Refresh token is required to update access token.");
      expect(consoleSpy).toHaveBeenCalledWith("Refresh token is required to update access token.");
    });

    it("propagates ApiError with InvalidAccessToken when refresh token is expired", async () => {
      server.use(
        http.post("*/auth/access-token", () =>
          HttpResponse.json(
            { error_code: "InvalidAccessToken", message: "refresh expired", request_id: "req-refresh-expire", status: "error" },
            { status: 401 },
          ),
        ),
      );
      const repository = createRepository();
      await expect(async () => {
        try {
          await repository.updateAccessToken("expired-refresh");
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).code).toBe("InvalidAccessToken");
          throw error;
        }
      }).rejects.toBeInstanceOf(ApiError);
    });
  });
});
