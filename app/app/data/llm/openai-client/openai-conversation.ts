import type { ResponseInputItem, ResponseOutputItem, ResponseFunctionCallOutputItemList, ResponseInput } from "openai/resources/responses/responses.mjs";
import type { FunctionCallRequest } from "./openai-func-call-tool";


export class OpenAIConversation {

  private messages: {
    type  : "input" | "output";
    record: ResponseInputItem | ResponseOutputItem | { type: "function_call_output"; id?: string; call_id: string; output: string | ResponseFunctionCallOutputItemList; };
  }[] = [];
  constructor() { }


  public addInput(input: ResponseInputItem) {
    this.messages.push({ type: "input", record: input });
  }

  public addInputs(inputs: ResponseInputItem[]) {
    inputs.forEach((input) => {
      this.messages.push({ type: "input", record: input });
    });
  }

  public addOutputs(output: ResponseOutputItem[]) {
    output.forEach((item) => {
      this.messages.push({ type: "output", record: item });
    });
  }

  public addFunctionResult(callId: string, output: string | ResponseFunctionCallOutputItemList) {
    this.messages.push({ type: "output", record: { type: "function_call_output", call_id: callId, output: output } });
  }

  public toOpenAIRequestInputs(): ResponseInput {
    const inputs: ResponseInput = [];

    for (const msg of this.messages) {
      // if input item
      if (msg.type === "input") {
        const record = msg.record as ResponseInputItem;
        inputs.push(record);
      } else if (msg.type === "output") {
        // if output item
        // output type in response
        // https://platform.openai.com/docs/api-reference/responses/object#responses-object-output-output_message
        // output type in input
        // https://platform.openai.com/docs/api-reference/responses/create#responses_create-input-input_item_list-item-output_message
        const record = msg.record as (ResponseOutputItem | { type: "function_call_output"; id?: string; call_id: string; output: string | ResponseFunctionCallOutputItemList; });
        const type = record.type;

        switch (type) {
          case "message":
            inputs.push({
              type   : "message",
              role   : "assistant",
              status : record.status,
              content: record.content
            } as ResponseInputItem);
            break;
          case "function_call":
            // function call output type
            // https://platform.openai.com/docs/api-reference/responses/object#responses-object-output-function_tool_call
            // function call input type
            // https://platform.openai.com/docs/api-reference/responses/create#responses_create-input-input_item_list-item-function_tool_call
            inputs.push({
              type     : "function_call",
              //   id       : record.id,
              call_id  : record.call_id,
              name     : record.name,
              arguments: record.arguments,
              status   : record.status
            });
            break;
        }
      }
    }
    return inputs;
  }


  public dumpFunctionCalls(output: ResponseOutputItem[]): FunctionCallRequest[] | undefined {
    const functionCalls: FunctionCallRequest[] = [];
    for (const item of output) {
      if (item.type === "function_call") {
        functionCalls.push({
          id       : item.id,
          funcName : item.name,
          arguments: item.arguments,
          callId   : item.call_id,
          rawData  : item
        });
      }
    }
    return functionCalls.length > 0 ? functionCalls : undefined;
  }

  public toJSON() {
    return JSON.stringify(this.messages);
  }

  public restoreFromJSON(jsonStr: string) {
    try {
      const arr = JSON.parse(jsonStr);
      this.messages = arr;
    } catch (error) {
      console.error("Failed to restore conversation from JSON:", error);
      throw new Error(`restore conversation failed, invalid conversation json data: ${jsonStr}, error: ${error}`);
    }
  }
}
