import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HttpToolRepository } from "./tool-repository-http-impl";
import { HttpClient } from "~/data/http-client/http-client";
import type { IAuthHelper } from "../interface/i-auth-helper";
import type { ToolsToolDto } from "~/data/generated-http-client";
import { officialTools } from "../../tools/official-tool-list";
import { ApiError } from "../http-client/api-error";

const server = setupServer();
const baseUrl = "https://api.tool.test";
const testToken = "token-123";

type AuthHelperStub = Pick<IAuthHelper, "executeWithAccessToken">;

function createRepository(helper?: AuthHelperStub) {
  const authHelper: AuthHelperStub =
    helper ??
    ({
      executeWithAccessToken: vi.fn(async (operation) => operation({ Authorization: "Bearer token-123" })),
    } as AuthHelperStub);
  return new HttpToolRepository(authHelper as IAuthHelper, new HttpClient({ baseUrl }));
}

function buildToolDto(overrides: Partial<ToolsToolDto> = {}): ToolsToolDto {
  return {
    tool_id           : "tool-1",
    uid               : "uid-1",
    name              : "Test Tool",
    namespace         : "WORKSPACE",
    category          : "",
    source            : "console.log('test');",
    ui_widgets        : JSON.stringify([]),
    is_activate       : true,
    realtime_execution: false,
    description       : "",
    extra_info        : {},
    created_at        : "2024-01-01T00:00:00.000Z",
    updated_at        : "2024-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function buildToolsResponse(dtos: ToolsToolDto[]) {
  return {
    data      : { tools: dtos, tools_last_update_at: new Date().toISOString() },
    message   : "ok",
    request_id: "req-1",
    status    : "success",
  };
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe("HttpToolRepository", () => {
  describe("fetchOfficialTools", () => {
    it("returns the predefined official tools", async () => {
      const repository = createRepository();
      const result = await repository.fetchOfficialTools();
      expect(result).toBe(officialTools);
    });
  });

  describe("fetchUserTools", () => {
    it("fetches and maps user tools", async () => {
      const headers: string[] = [];
      server.use(
        http.get("*/tools", async ({ request }) => {
          headers.push(request.headers.get("authorization") ?? "");
          return HttpResponse.json(buildToolsResponse([buildToolDto()]));
        }),
      );
      const repository = createRepository();
      const tools = await repository.fetchUserTools();
      expect(headers[0]).toBe("Bearer token-123");
      expect(tools).toEqual([
        {
          id               : "tool-1",
          uid              : "uid-1",
          name             : "Test Tool",
          namespace        : "WORKSPACE",
          category         : "",
          isOfficial       : false,
          isActive         : true,
          realtimeExecution: false,
          description      : "",
          extraInfo        : {},
          uiWidgets        : [],
          source           : "console.log('test');",
        },
      ]);
    });

    it("throws when access token is missing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const helper: AuthHelperStub = {
        executeWithAccessToken: vi.fn(async () => {
          console.error("Missing access token for Tool API requests.");
          throw new Error("Missing access token for Tool API requests.");
        }),
      };
      const repository = createRepository(helper);
      await expect(repository.fetchUserTools()).rejects.toThrow("Missing access token for Tool API requests.");
      expect(consoleSpy).toHaveBeenCalledWith("Missing access token for Tool API requests.");
    });

    it("refreshes access token and retries once when API reports InvalidAccessToken", async () => {
      let callCount = 0;
      server.use(
        http.get("*/tools", ({ request }) => {
          callCount += 1;
          if (callCount === 1) {
            expect(request.headers.get("authorization")).toBe("Bearer expired-token");
            return HttpResponse.json(
              { error_code: "InvalidAccessToken", message: "expired", request_id: "req-expired", status: "error" },
              { status: 401 }
            );
          }
          expect(request.headers.get("authorization")).toBe("Bearer fresh-token");
          return HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "retry-success" })]));
        })
      );
      const helper: AuthHelperStub = {
        executeWithAccessToken: vi.fn(async (operation) => {
          try {
            return await operation({ Authorization: "Bearer expired-token" });
          } catch (error) {
            if (error instanceof ApiError && error.code === "InvalidAccessToken") {
              return operation({ Authorization: "Bearer fresh-token" });
            }
            throw error;
          }
        }),
      };
      const repository = createRepository(helper);
      const tools = await repository.fetchUserTools();
      expect(helper.executeWithAccessToken).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(2);
      expect(tools[0].id).toBe("retry-success");
    });
  });

  describe("fetchAllTools", () => {
    it("combines official and user tools", async () => {
      server.use(
        http.get("*/tools", () => HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "user-tool" })]))),
      );
      const repository = createRepository();
      const result = await repository.fetchAllTools();
      expect(result.tools).toEqual([...officialTools, expect.objectContaining({ id: "user-tool" })]);
      expect(result.userToolsError).toBeUndefined();
    });

    it("returns official tools when user fetch fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(
        http.get("*/tools", () =>
          HttpResponse.json(
            { error_code: "InternalServerError", message: "boom", request_id: "req-err", status: "error" },
            { status: 500 },
          ),
        ),
      );
      const repository = createRepository();
      const result = await repository.fetchAllTools();
      expect(result.tools).toEqual(officialTools);
      expect(result.userToolsError).toBeTruthy();
      expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch user tools", expect.any(Error));
    });
  });

  describe("createUserTool", () => {
    it("creates tool and refetches list", async () => {
      const bodies: any[] = [];
      server.use(
        http.post("*/tools/create", async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ data: {}, message: "ok", request_id: "req-create", status: "success" });
        }),
        http.get("*/tools", () => HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "new-tool" })]))),
      );
      const repository = createRepository();
      const payload = { id: " new-tool ", name: "Custom Tool ", source: "console.log('new');", uiWidgets: [], namespace: "", isActive: undefined, realtimeExecution: undefined, isOfficial: true, description: "", extraInfo: {} };
      const tools = await repository.createUserTool(payload);
      expect(bodies[0]).toEqual({
        id                : "new-tool",
        name              : "Custom Tool",
        namespace         : "default",
        category          : "",
        source            : "console.log('new');",
        description       : "",
        extra_info        : {},
        ui_widgets        : "[]",
        is_activate       : true,
        realtime_execution: false,
      });
      expect(tools[0].id).toBe("new-tool");
    });
  });

  describe("updateUserTool", () => {
    it("throws when tool uid is missing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const repository = createRepository();
      await expect(repository.updateUserTool("", {})).rejects.toThrow("Tool uid is required.");
      expect(consoleSpy).toHaveBeenCalledWith("Tool uid is required.");
    });

    it("throws when tool is not found", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(
        http.get("*/tools", () => HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "other-tool", uid: "other-uid" })]))),
      );
      const repository = createRepository();
      await expect(repository.updateUserTool("missing-uid", { name: "Updated" })).rejects.toThrow("Tool with uid \"missing-uid\" does not exist.");
      expect(consoleSpy).toHaveBeenCalledWith("Tool with uid \"missing-uid\" does not exist.");
    });

    it("updates tool and returns refreshed tools", async () => {
      let getCalls = 0;
      const putBodies: any[] = [];
      server.use(
        http.get("*/tools", () => {
          getCalls += 1;
          if (getCalls === 1) {
            return HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "tool-1", uid: "uid-1", namespace: "default", source: "console.log('old');" })]));
          }
          return HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "tool-1", uid: "uid-1", name: "Updated Tool" })]));
        }),
        http.put("*/tools/:tool_uid", async ({ request, params }) => {
          putBodies.push(await request.json());
          expect(params.tool_uid).toBe("uid-1");
          return HttpResponse.json({ data: {}, message: "ok", request_id: "req-put", status: "success" });
        }),
      );
      const repository = createRepository();
      const tools = await repository.updateUserTool("uid-1", { name: "Updated Tool" });
      expect(putBodies[0]).toEqual({
        id                : "tool-1",
        name              : "Updated Tool",
        namespace         : "default",
        category          : "",
        source            : "console.log('old');",
        description       : "",
        extra_info        : {},
        ui_widgets        : "[]",
        is_activate       : true,
        realtime_execution: false,
      });
      expect(tools[0].name).toBe("Updated Tool");
    });

    it("updates tool with new id and sends updated id in request body", async () => {
      let getCalls = 0;
      const putBodies: any[] = [];
      server.use(
        http.get("*/tools", () => {
          getCalls += 1;
          if (getCalls === 1) {
            return HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "old-id", uid: "uid-1", namespace: "default", source: "console.log('old');" })]));
          }
          return HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "new-id", uid: "uid-1", name: "Updated Tool" })]));
        }),
        http.put("*/tools/:tool_uid", async ({ request, params }) => {
          putBodies.push(await request.json());
          expect(params.tool_uid).toBe("uid-1");
          return HttpResponse.json({ data: {}, message: "ok", request_id: "req-put", status: "success" });
        }),
      );
      const repository = createRepository();
      const tools = await repository.updateUserTool("uid-1", { id: "new-id", name: "Updated Tool" });
      expect(putBodies[0]).toEqual({
        id                : "new-id",
        name              : "Updated Tool",
        namespace         : "default",
        category          : "",
        source            : "console.log('old');",
        description       : "",
        extra_info        : {},
        ui_widgets        : "[]",
        is_activate       : true,
        realtime_execution: false,
      });
      expect(tools[0].id).toBe("new-id");
    });
  });

  describe("deleteUserTool", () => {
    it("throws when tool uid missing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const repository = createRepository();
      await expect(repository.deleteUserTool("")).rejects.toThrow("Tool uid is required.");
      expect(consoleSpy).toHaveBeenCalledWith("Tool uid is required.");
    });

    it("deletes tool and returns remaining list", async () => {
      const deleted: string[] = [];
      server.use(
        http.delete("*/tools/:tool_uid", ({ params }) => {
          deleted.push(params.tool_uid as string);
          return HttpResponse.json({ data: {}, message: "ok", request_id: "req-del", status: "success" });
        }),
        http.get("*/tools", () => HttpResponse.json(buildToolsResponse([buildToolDto({ tool_id: "remaining", uid: "uid-remaining" })]))),
      );
      const repository = createRepository();
      const tools = await repository.deleteUserTool("uid-obsolete");
      expect(deleted).toEqual(["uid-obsolete"]);
      expect(tools[0].id).toBe("remaining");
    });
  });

  describe("resetUserTools", () => {
    it("throws because reset is unsupported in logined mode", async () => {
      const repository = createRepository();
      await expect(repository.resetUserTools()).rejects.toThrow("Reset user tools is not supported when you are logined.");
    });
  });

  describe("fetchGlobalScript", () => {
    it("retrieves the script from API", async () => {
      const headers: string[] = [];
      server.use(
        http.get("*/global-script", ({ request }) => {
          headers.push(request.headers.get("authorization") ?? "");
          return HttpResponse.json({
            data      : { global_script: "console.log('global');", updated_at: new Date().toISOString() },
            message   : "ok",
            request_id: "req-global-get",
            status    : "success",
          });
        })
      );
      const repository = createRepository();
      const script = await repository.fetchGlobalScript();
      expect(headers[0]).toBe("Bearer token-123");
      expect(script).toBe("console.log('global');");
    });
  });

  describe("saveGlobalScript", () => {
    it("persists script then refetches value", async () => {
      const bodies: any[] = [];
      server.use(
        http.put("*/global-script", async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ data: {}, message: "ok", request_id: "req-global-put", status: "success" });
        }),
        http.get("*/global-script", () =>
          HttpResponse.json({
            data      : { global_script: "console.log('saved');", updated_at: new Date().toISOString() },
            message   : "ok",
            request_id: "req-global-get",
            status    : "success",
          }),
        ),
      );
      const repository = createRepository();
      const script = await repository.saveGlobalScript("console.log('draft');");
      expect(bodies[0]).toEqual({ global_script: "console.log('draft');" });
      expect(script).toBe("console.log('saved');");
    });
  });

});
