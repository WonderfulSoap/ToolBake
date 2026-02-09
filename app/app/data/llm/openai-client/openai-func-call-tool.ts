import type { Tool } from "openai/resources/responses/responses.mjs";
import z from "zod";

export class OpenAITool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name       : string;
  description: string;
  func_params: T;
  func       : (args: z.infer<T>) => string;

  constructor(
    toolInfo : {
      name       : string,
      description: string,
      func_params: T,
      func       : (args: z.infer<T>) => string
    }
  ) {
    this.name = toolInfo.name;
    this.description = toolInfo.description;
    this.func_params = toolInfo.func_params;
    this.func = toolInfo.func;
  }

  toOpenAIRawToolDefinition(): Tool {
    return {
      strict     : true,
      type       : "function",
      name       : this.name,
      description: this.description,
      parameters : z.toJSONSchema(this.func_params),
    };
  }
}


export type FunctionCallRequest = {
  id?      : string,
  funcName : string,
  arguments: string,
  callId   : string,

  rawData: any
    
};

export interface OpenAIFunctionCallResult {
  id     ?: string,
  type    : "function_call_output",
  call_id : string,
  output  : string
}

export class OpenAITools {
  public tools: OpenAITool[];

  // the map of tool name to tool
  // ex:
  // {
  //     get_weather: OpenAIToolInstance,
  //     get_time   : OpenAIToolInstance
  // }
  public toolsMap: Record<string, OpenAITool>;

  constructor(tools?: OpenAITool[]) {
    this.tools = tools || [];
    this.toolsMap = Object.fromEntries(this.tools.map(tool => [tool.name, tool]));
  }

  addTool<T extends z.ZodTypeAny>(tool: OpenAITool<T>) {
    this.tools.push(tool);
    this.toolsMap[tool.name] = tool;
  }

  toOpenAIApiRawToolDefinitions(): Tool[] {
    return this.tools.map( tool => tool.toOpenAIRawToolDefinition());
  }


  handleFunctionCalls(functionCalls: FunctionCallRequest[]): OpenAIFunctionCallResult[] {
    const results: OpenAIFunctionCallResult[] = [];
    for (const funcCall of functionCalls) {
      const tool = this.toolsMap[funcCall.funcName];
      if (!tool) {
        throw new Error(`function_call failed:tool_not_found_in_tool_list. No tool found in tool definitions. provided function name: ${funcCall.funcName}, function list: ${Object.keys(this.toolsMap).join(", ")}`);
      }

      // call function dynamically
      const args = JSON.parse(funcCall.arguments);
      const result = tool.func(args);
      results.push({
        // id     : funcCall.id,
        type   : "function_call_output",
        call_id: funcCall.callId,
        output : result
      });
    }
    return results;
  }
}