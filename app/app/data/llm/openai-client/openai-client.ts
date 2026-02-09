import OpenAI from "openai";
import type { ResponseInput, Tool } from "openai/resources/responses/responses.mjs";

export class OpenAIClient {

  private client: OpenAI;
  constructor(apiKey: string, apiUrl: string) {
    this.client = new OpenAI({
      apiKey                 : apiKey,
      baseURL                : apiUrl,
      dangerouslyAllowBrowser: true,
    });
  }



  public async responsesCreate(model: string, inputs: ResponseInput, tools?: Tool[], extraParams?: Record<string, unknown>) {
    const response = await this.client.responses.create({
      ...extraParams,
      model: model,
      input: inputs,
      tools: tools,
    });
    return response;
  }

  public async responsesCreateStream(model: string, inputs: ResponseInput, tools?: Tool[], extraParams?: Record<string, unknown>) {
    const response = await this.client.responses.create({
      ...extraParams,
      model : model,
      input : inputs,
      tools : tools,
      stream: true,
    });
    return response;
  }



  public async testConnection(): Promise<{result: boolean, error?: unknown}> {
    try {
      // Attempt to list models as a way to test the connection
      await this.client.models.list();
      return { result: true };
    } catch (error) {
      console.error("OpenAI connection test failed:", error);
      return { result: false, error };
    }

  }


  public async getModels() {
    const response = await this.client.models.list();
    return response;
  }

}
