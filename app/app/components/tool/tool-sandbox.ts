import { globalDI } from "~/di/global-di";
import type { Tool } from "~/entity/tool";



export class ToolSandbox {

  private sourceCode    : string;
  // Pre-built sandbox context to avoid repeated context creation
  private sandboxContext: Record<string, unknown>;
  // Cached handler info to preserve closure state between executions
  private handlerInfo   : { handlerRef?: (...args: unknown[]) => unknown, handlerType: string };

  constructor(
    private toool: Tool,
    sandboxContextOverrides: Record<string, unknown> = {},
    requirePackageHooks?: { onStart: (pkg: string) => void; onEnd: (pkg: string, error?: unknown) => void }
  ){
    this.sourceCode = toool.source;
    // Build sandbox context once during construction
    this.sandboxContext = this.buildSandboxContext(sandboxContextOverrides, requirePackageHooks);
    // Build the sandbox executor and execute it once during construction to create handler
    const executor = new Function(
      "sandbox",
      `with (sandbox) {
${this.sourceCode}

const handlerType = typeof handler;
return {
  handlerRef: handlerType === "function" ? handler : undefined,
  handlerType,
};
//# sourceURL=handler.js
        }
      `
    ) as (sandbox: Record<string, unknown>) => { handlerRef?: (...args: unknown[]) => unknown; handlerType: string };
    // Execute once to get handler and preserve its closure
    this.handlerInfo = executor(this.sandboxContext);
  }



  async executeHandler(
    inputWidgets: Record<string, unknown>,
    changedWidgetId: string | undefined,
    uiUpdateCallback: (output: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>|undefined> {
    const handlerArgs = [inputWidgets, changedWidgetId, uiUpdateCallback, this.sandboxContext];
    // Validate handler type (validation moved from first execution to every execution for clarity)
    if (this.handlerInfo.handlerType === "undefined") {
      // Mirror test expectations when handler is missing.
      throw new Error("[ToolSandbox] hander function is not defined in your tool handler.js.");
    }
    if (this.handlerInfo.handlerType !== "function" || !this.handlerInfo.handlerRef) {
      // Mirror test expectations when handler is not a function.
      throw new Error("[ToolSandbox] hander must be define as function: function handler(event, context) { ... }");
    }
    try {
      const result = await this.handlerInfo.handlerRef(...handlerArgs);
      // if result is not a object, throw error
      if (result && typeof result !== "object") {
        throw new Error("[ToolSandbox] handler must return an object, undefined, or null.");
      }
      return result as Record<string, unknown>;
    } catch (error) {
      console.error("[Tool sandbox execution failed] ", error);
      throw error;
    }
  }


  private buildSandboxContext(
    overrides: Record<string, unknown> = {},
    requirePackageHooks?: { onStart: (pkg: string) => void; onEnd: (pkg: string, error?: unknown) => void }
  ): Record<string, unknown> {
    const context: Record<string, unknown> = {
      requirePackage: globalDI.toolSandboxRequirePackage.requirePackageFactory(
        requirePackageHooks?.onStart,
        requirePackageHooks?.onEnd
      ),
    };

    // Explicitly copy allowed globals
    const allowedGlobals: Array<keyof typeof globalThis> = [
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

      // Timers
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
    // Expose the allowlist for handler introspection and tests.
    context.allowedGlobals = allowedGlobals;
    const unboundGlobals = new Set<keyof typeof globalThis>(["URL", "URLSearchParams", "Worker", "Blob"]);
    allowedGlobals.forEach((prop) => {
      const value = globalThis[prop];
      // Avoid binding constructors so their static helpers stay available (e.g. URL.createObjectURL).
      context[prop] = typeof value === "function" && !unboundGlobals.has(prop) ? value.bind(globalThis) : value;
    });



    // Emulate global objects
    context.window = context;
    context.self = context;
    context.globalThis = context;


    // use overrides to overwrite or add any properties
    for (const [key, value] of Object.entries(overrides)) {
      context[key] = value;
    }
    return context;
  }



}
