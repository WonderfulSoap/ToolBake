import { describe, expect, it, vi } from "vitest";
import type { Tool } from "~/entity/tool";
import { ToolSandbox } from "~/components/tool/tool-sandbox";

function buildTool(source: string): Tool {
  // Minimal Tool shape for sandbox tests.
  return {
    id         : "tool-sandbox-test",
    name       : "Tool Sandbox Test",
    namespace  : "WORKSPACE",
    isOfficial : false,
    description: "",
    extraInfo  : {},
    uiWidgets  : [],
    source,
  };
}

function buildAllowedGlobals(): Array<keyof typeof globalThis> {
  return [
    "screen",
    "innerWidth",
    "innerHeight",
    "outerWidth",
    "outerHeight",
    "devicePixelRatio",
    "navigator",
    "performance",
    "URL",
    "URLSearchParams",
    "Worker",
    "Blob",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "setImmediate",
    "clearImmediate",
    "fetch",
    "btoa",
    "atob",
  ];
}

describe("ToolSandbox.executeHandler", function () {
  // Typed history payload for the multi-execution test assertions.
  type HistoryEntry = { executionNumber: number; input: string; changedId: string | undefined };
  type HistoryResult = { currentCount: number; totalExecutions: number; lastThreeExecutions: HistoryEntry[] };

  it("executes handler and returns output", async function () {
    // Verify the handler can return a value and call the UI callback.
    const tool = buildTool(`
      async function handler(input, changedId, callback) {
        callback({ fromCallback: input.value });
        return { result: changedId };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({ value: 123 }, "widget-1", uiUpdateCallback);

    expect(result).toEqual({ result: "widget-1" });
    expect(uiUpdateCallback).toHaveBeenCalledWith({ fromCallback: 123 });
  });

  it("exposes sandbox context and overrides to handler", async function () {
    // Ensure sandbox context globals and overrides are accessible inside the handler.
    const tool = buildTool(`
      function handler(input, changedId, callback, context) {
        return {
          hasOverride: context.customValue,
          isWindowSelfGlobal: context.window === context.self && context.self === context.globalThis,
          hasTimer: typeof context.setTimeout === "function",
        };
      }
    `);
    const sandbox = new ToolSandbox(tool, { customValue: "ok" });
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({}, undefined, uiUpdateCallback);

    expect(result).toEqual({
      hasOverride       : "ok",
      isWindowSelfGlobal: true,
      hasTimer          : true,
    });
  });

  it("injects all allowed globals into the sandbox context", async function () {
    // Validate injected globals match expected types or values.
    const tool = buildTool(`
      function handler(input, changedId, callback, context) {
        const output = {};
        context.allowedGlobals.forEach((name) => { output[name] = context[name]; });
        return output;
      }
    `);
    const allowedGlobals = buildAllowedGlobals();
    const sandbox = new ToolSandbox(tool, { allowedGlobals });
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({}, undefined, uiUpdateCallback);

    allowedGlobals.forEach((name) => {
      const globalValue = globalThis[name];
      const sandboxValue = result?.[name as string];
      if (typeof globalValue === "function") expect(typeof sandboxValue).toBe("function");
      else expect(sandboxValue).toBe(globalValue);
    });
  });
  it("throws when handler errors", async function () {
    // Ensure handler errors are surfaced and logged.
    const tool = buildTool(`function handler(input, changedId, callback) {
        console.log("This is a log message inside the sandbox.");

        throw new Error("Handler error");
        return { };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();
    await expect(sandbox.executeHandler({}, undefined, uiUpdateCallback)).rejects.toThrow("Handler error");
  });

  it("throws when handler is missing", async function () {
    // Verify explicit error when the handler export does not exist.
    const tool = buildTool("function notHandler() { return {}; }");
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    await expect(sandbox.executeHandler({}, undefined, uiUpdateCallback)).rejects.toThrow(
      "[ToolSandbox] hander function is not defined in your tool handler.js.",
    );
  });

  it("throws when handler is not a function", async function () {
    // Validate type guard for handler export.
    const tool = buildTool("const handler = \"not-a-function\";");
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    await expect(sandbox.executeHandler({}, undefined, uiUpdateCallback)).rejects.toThrow(
      "[ToolSandbox] hander must be define as function: function handler(event, context) { ... }",
    );
  });

  it("throws when handler returns a non-object value", async function () {
    // Ensure handler return values are validated for object shape.
    const tool = buildTool(`
      function handler() {
        return 123;
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    await expect(sandbox.executeHandler({}, undefined, uiUpdateCallback)).rejects.toThrow(
      "[ToolSandbox] handler must return an object, undefined, or null.",
    );
  });

  it("preserves context variables between multiple executions", async function () {
    // Verify that variables declared outside handler persist across multiple executions.
    const tool = buildTool(`
      let counter = 0;
      let history = [];

      function handler(input, changedId) {
        counter++;
        history.push({
          executionNumber: counter,
          input: input.value,
          changedId: changedId
        });

        return {
          currentCount: counter,
          totalExecutions: history.length,
          lastThreeExecutions: history.slice(-3)
        };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    // First execution
    const result1 = await sandbox.executeHandler({ value: "first" }, "widget-1", uiUpdateCallback);
    expect(result1).toEqual({
      currentCount       : 1,
      totalExecutions    : 1,
      lastThreeExecutions: [{ executionNumber: 1, input: "first", changedId: "widget-1" }],
    });

    // Second execution
    const result2 = await sandbox.executeHandler({ value: "second" }, "widget-2", uiUpdateCallback);
    expect(result2).toEqual({
      currentCount       : 2,
      totalExecutions    : 2,
      lastThreeExecutions: [
        { executionNumber: 1, input: "first", changedId: "widget-1" },
        { executionNumber: 2, input: "second", changedId: "widget-2" },
      ],
    });

    // Third execution
    const result3 = await sandbox.executeHandler({ value: "third" }, undefined, uiUpdateCallback);
    expect(result3).toEqual({
      currentCount       : 3,
      totalExecutions    : 3,
      lastThreeExecutions: [
        { executionNumber: 1, input: "first", changedId: "widget-1" },
        { executionNumber: 2, input: "second", changedId: "widget-2" },
        { executionNumber: 3, input: "third", changedId: undefined },
      ],
    });

    // Fourth execution - verify history keeps growing
    const result4 = await sandbox.executeHandler({ value: "fourth" }, "widget-4", uiUpdateCallback) as HistoryResult;
    expect(result4.currentCount).toBe(4);
    expect(result4.totalExecutions).toBe(4);
    expect(result4.lastThreeExecutions).toHaveLength(3);
    expect(result4.lastThreeExecutions[2]).toEqual({
      executionNumber: 4,
      input          : "fourth",
      changedId      : "widget-4",
    });
  });

  it("closure returned by handler can access var/let/const variables after sandbox execution", async function () {
    // Test that closures returned from handler can correctly access variables defined with var, let, and const.
    const tool = buildTool(`
      function handler(input) {
        var varValue = "var-" + input.suffix;
        let letValue = "let-" + input.suffix;
        const constValue = "const-" + input.suffix;

        // Nested function that closes over all three variable types
        function getVarValue() { return varValue; }
        function getLetValue() { return letValue; }
        function getConstValue() { return constValue; }

        // Arrow function closures
        const arrowGetVar = () => varValue;
        const arrowGetLet = () => letValue;
        const arrowGetConst = () => constValue;

        // Combined closure returning all values
        const getAllValues = () => ({
          fromVar: varValue,
          fromLet: letValue,
          fromConst: constValue,
        });

        return {
          getVarValue,
          getLetValue,
          getConstValue,
          arrowGetVar,
          arrowGetLet,
          arrowGetConst,
          getAllValues,
        };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({ suffix: "test" }, undefined, uiUpdateCallback) as {
      getVarValue: () => string; getLetValue: () => string; getConstValue: () => string;
      arrowGetVar: () => string; arrowGetLet: () => string; arrowGetConst: () => string;
      getAllValues: () => { fromVar: string; fromLet: string; fromConst: string };
    };

    // Verify all closure functions exist
    expect(typeof result?.getVarValue).toBe("function");
    expect(typeof result?.getLetValue).toBe("function");
    expect(typeof result?.getConstValue).toBe("function");
    expect(typeof result?.arrowGetVar).toBe("function");
    expect(typeof result?.arrowGetLet).toBe("function");
    expect(typeof result?.arrowGetConst).toBe("function");
    expect(typeof result?.getAllValues).toBe("function");

    // Call closures after sandbox execution has completed - verify var/let/const are all accessible
    expect(result?.getVarValue()).toBe("var-test");
    expect(result?.getLetValue()).toBe("let-test");
    expect(result?.getConstValue()).toBe("const-test");

    // Arrow function closures should also work
    expect(result?.arrowGetVar()).toBe("var-test");
    expect(result?.arrowGetLet()).toBe("let-test");
    expect(result?.arrowGetConst()).toBe("const-test");

    // Combined closure
    expect(result?.getAllValues()).toEqual({
      fromVar  : "var-test",
      fromLet  : "let-test",
      fromConst: "const-test",
    });
  });

  it("closure can mutate var/let variables but not const after sandbox execution", async function () {
    // Test that closures can mutate var and let, but const remains immutable.
    const tool = buildTool(`
      function handler() {
        var varCounter = 0;
        let letCounter = 0;
        const constValue = "immutable";

        const incrementVar = () => ++varCounter;
        const incrementLet = () => ++letCounter;
        const getValues = () => ({ varCounter, letCounter, constValue });

        return { incrementVar, incrementLet, getValues };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      incrementVar: () => number; incrementLet: () => number;
      getValues: () => { varCounter: number; letCounter: number; constValue: string };
    };

    // Initial state
    expect(result?.getValues()).toEqual({ varCounter: 0, letCounter: 0, constValue: "immutable" });

    // Mutate via closures after sandbox execution
    expect(result?.incrementVar()).toBe(1);
    expect(result?.incrementVar()).toBe(2);
    expect(result?.incrementLet()).toBe(1);
    expect(result?.incrementLet()).toBe(2);
    expect(result?.incrementLet()).toBe(3);

    // Verify mutations persisted
    expect(result?.getValues()).toEqual({ varCounter: 2, letCounter: 3, constValue: "immutable" });
  });

  it("nested closures preserve scope chain after sandbox execution", async function () {
    // Test deeply nested closures that capture variables from multiple scopes.
    type InnerResult = {
      getAll: () => { outer: string; outerLet: number; middle: string; middleLet: number; inner: string };
      incrementOuter: () => number; incrementMiddle: () => number;
    };
    const tool = buildTool(`
      function handler(input) {
        const outerConst = "outer-" + input.id;
        let outerLet = 0;

        function createMiddle(middleArg) {
          const middleConst = "middle-" + middleArg;
          let middleLet = 100;

          return function createInner(innerArg) {
            const innerConst = "inner-" + innerArg;

            return {
              getAll: () => ({
                outer: outerConst,
                outerLet: outerLet,
                middle: middleConst,
                middleLet: middleLet,
                inner: innerConst,
              }),
              incrementOuter: () => ++outerLet,
              incrementMiddle: () => ++middleLet,
            };
          };
        }

        return { createMiddle };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({ id: "123" }, undefined, uiUpdateCallback) as {
      createMiddle: (arg: string) => (innerArg: string) => InnerResult;
    };

    // Create nested closures after sandbox execution
    const middle = result?.createMiddle("A");
    const inner = middle("X");

    expect(inner.getAll()).toEqual({
      outer    : "outer-123",
      outerLet : 0,
      middle   : "middle-A",
      middleLet: 100,
      inner    : "inner-X",
    });

    // Mutate through nested closures
    inner.incrementOuter();
    inner.incrementMiddle();
    inner.incrementMiddle();

    expect(inner.getAll()).toEqual({
      outer    : "outer-123",
      outerLet : 1,
      middle   : "middle-A",
      middleLet: 102,
      inner    : "inner-X",
    });

    // Create another inner from same middle - should share middleLet but have own innerConst
    const inner2 = middle("Y");
    expect(inner2.getAll().middleLet).toBe(102); // Shared with inner
    expect(inner2.getAll().inner).toBe("inner-Y"); // Own value
    expect(inner2.getAll().outerLet).toBe(1); // Shared outerLet
  });

  it("closure can access and mutate arrays stored in handler scope", async function () {
    // Test that closures can read/write arrays defined with var, let, and const.
    const tool = buildTool(`
      function handler() {
        var varArray = [1, 2, 3];
        let letArray = ["a", "b"];
        const constArray = [100];

        return {
          getVarArray: () => varArray,
          getLetArray: () => letArray,
          getConstArray: () => constArray,
          pushToVar: (v) => { varArray.push(v); return varArray; },
          pushToLet: (v) => { letArray.push(v); return letArray; },
          pushToConst: (v) => { constArray.push(v); return constArray; },
          replaceVarArray: (arr) => { varArray = arr; },
          replaceLetArray: (arr) => { letArray = arr; },
        };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      getVarArray: () => number[]; getLetArray: () => string[]; getConstArray: () => number[];
      pushToVar: (v: number) => number[]; pushToLet: (v: string) => string[]; pushToConst: (v: number) => number[];
      replaceVarArray: (arr: number[]) => void; replaceLetArray: (arr: string[]) => void;
    };

    // Initial state
    expect(result.getVarArray()).toEqual([1, 2, 3]);
    expect(result.getLetArray()).toEqual(["a", "b"]);
    expect(result.getConstArray()).toEqual([100]);

    // Mutate array contents (allowed for const since array reference doesn't change)
    expect(result.pushToVar(4)).toEqual([1, 2, 3, 4]);
    expect(result.pushToLet("c")).toEqual(["a", "b", "c"]);
    expect(result.pushToConst(200)).toEqual([100, 200]);

    // Verify mutations persisted
    expect(result.getVarArray()).toEqual([1, 2, 3, 4]);
    expect(result.getLetArray()).toEqual(["a", "b", "c"]);
    expect(result.getConstArray()).toEqual([100, 200]);

    // Replace entire array reference (only works for var and let)
    result.replaceVarArray([99]);
    result.replaceLetArray(["z"]);
    expect(result.getVarArray()).toEqual([99]);
    expect(result.getLetArray()).toEqual(["z"]);
  });

  it("closure can access and mutate objects stored in handler scope", async function () {
    // Test that closures can read/write objects defined with var, let, and const.
    const tool = buildTool(`
      function handler() {
        var varObj = { x: 1, y: 2 };
        let letObj = { name: "test" };
        const constObj = { id: 100 };

        return {
          getVarObj: () => varObj,
          getLetObj: () => letObj,
          getConstObj: () => constObj,
          setVarProp: (k, v) => { varObj[k] = v; return varObj; },
          setLetProp: (k, v) => { letObj[k] = v; return letObj; },
          setConstProp: (k, v) => { constObj[k] = v; return constObj; },
          deleteVarProp: (k) => { delete varObj[k]; return varObj; },
          replaceVarObj: (obj) => { varObj = obj; },
          replaceLetObj: (obj) => { letObj = obj; },
        };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    const result = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      getVarObj: () => Record<string, unknown>; getLetObj: () => Record<string, unknown>; getConstObj: () => Record<string, unknown>;
      setVarProp   : (k: string, v: unknown) => Record<string, unknown>;
      setLetProp   : (k: string, v: unknown) => Record<string, unknown>;
      setConstProp : (k: string, v: unknown) => Record<string, unknown>;
      deleteVarProp: (k: string) => Record<string, unknown>;
      replaceVarObj: (obj: Record<string, unknown>) => void;
      replaceLetObj: (obj: Record<string, unknown>) => void;
    };

    // Initial state
    expect(result.getVarObj()).toEqual({ x: 1, y: 2 });
    expect(result.getLetObj()).toEqual({ name: "test" });
    expect(result.getConstObj()).toEqual({ id: 100 });

    // Mutate object properties (allowed for const since object reference doesn't change)
    expect(result.setVarProp("z", 3)).toEqual({ x: 1, y: 2, z: 3 });
    expect(result.setLetProp("age", 25)).toEqual({ name: "test", age: 25 });
    expect(result.setConstProp("extra", "value")).toEqual({ id: 100, extra: "value" });

    // Delete property
    expect(result.deleteVarProp("x")).toEqual({ y: 2, z: 3 });

    // Verify mutations persisted
    expect(result.getVarObj()).toEqual({ y: 2, z: 3 });
    expect(result.getLetObj()).toEqual({ name: "test", age: 25 });
    expect(result.getConstObj()).toEqual({ id: 100, extra: "value" });

    // Replace entire object reference (only works for var and let)
    result.replaceVarObj({ replaced: true });
    result.replaceLetObj({ also: "replaced" });
    expect(result.getVarObj()).toEqual({ replaced: true });
    expect(result.getLetObj()).toEqual({ also: "replaced" });
  });

  it("closure preserves nested object/array references correctly", async function () {
    // Test deeply nested data structures in closures.
    const tool = buildTool(`
      function handler() {
        const data = {
          users: [
            { id: 1, name: "Alice", tags: ["admin"] },
            { id: 2, name: "Bob", tags: ["user"] },
          ],
          config: { nested: { deep: { value: 42 } } },
        };

        return {
          getData: () => data,
          getUser: (idx) => data.users[idx],
          addUser: (user) => { data.users.push(user); return data.users.length; },
          addTag: (userIdx, tag) => { data.users[userIdx].tags.push(tag); },
          updateDeepValue: (v) => { data.config.nested.deep.value = v; },
          getDeepValue: () => data.config.nested.deep.value,
        };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    type User = { id: number; name: string; tags: string[] };
    const result = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      getData        : () => { users: User[]; config: { nested: { deep: { value: number } } } };
      getUser        : (idx: number) => User;
      addUser        : (user: User) => number;
      addTag         : (userIdx: number, tag: string) => void;
      updateDeepValue: (v: number) => void;
      getDeepValue   : () => number;
    };

    // Initial state
    expect(result.getUser(0)).toEqual({ id: 1, name: "Alice", tags: ["admin"] });
    expect(result.getDeepValue()).toBe(42);

    // Mutate nested array
    result.addTag(0, "superuser");
    expect(result.getUser(0).tags).toEqual(["admin", "superuser"]);

    // Add new item to nested array
    expect(result.addUser({ id: 3, name: "Charlie", tags: [] })).toBe(3);
    expect(result.getData().users).toHaveLength(3);
    expect(result.getUser(2)).toEqual({ id: 3, name: "Charlie", tags: [] });

    // Mutate deeply nested value
    result.updateDeepValue(999);
    expect(result.getDeepValue()).toBe(999);
    expect(result.getData().config.nested.deep.value).toBe(999);
  });

  it("closure mutations persist across multiple handler executions", async function () {
    // Test that closures returned from one execution can modify state visible to subsequent executions.
    const tool = buildTool(`
      let sharedCounter = 0;
      const sharedArray = [];

      function handler() {
        sharedCounter++;
        sharedArray.push(sharedCounter);

        return {
          currentCounter: sharedCounter,
          history: [...sharedArray],
          setCounter: (v) => { sharedCounter = v; },
          pushToArray: (v) => { sharedArray.push(v); },
        };
      }
    `);
    const sandbox = new ToolSandbox(tool);
    const uiUpdateCallback = vi.fn();

    // First execution
    const result1 = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      currentCounter: number; history: number[];
      setCounter: (v: number) => void; pushToArray: (v: number) => void;
    };
    expect(result1.currentCounter).toBe(1);
    expect(result1.history).toEqual([1]);

    // Mutate via closure from first execution
    result1.setCounter(100);
    result1.pushToArray(999);

    // Second execution - should see the mutations
    const result2 = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      currentCounter: number; history: number[];
    };
    expect(result2.currentCounter).toBe(101);  // 100 + 1
    expect(result2.history).toEqual([1, 999, 101]);  // Original 1, pushed 999, new 101

    // Third execution - continues from mutated state
    const result3 = await sandbox.executeHandler({}, undefined, uiUpdateCallback) as {
      currentCounter: number; history: number[];
    };
    expect(result3.currentCounter).toBe(102);
    expect(result3.history).toEqual([1, 999, 101, 102]);
  });
});
