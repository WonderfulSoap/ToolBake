import { OpenAIClient } from "./openai-client";
import { OpenAIConversation } from "./openai-conversation";
import { describe, it } from "vitest";
import { OpenAITool, OpenAITools } from "./openai-func-call-tool";
import z from "zod";


describe("OpenAIClient", { timeout: 1000000 }, () => {
  it("should create an instance of OpenAIClient", async () => {
    // Test implementation
    const client = new OpenAIClient("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", "https://api.openai.com/v1");

    const conversation = new OpenAIConversation();

    conversation.addInput(
      {
        role   : "user",
        content: [
          { type: "input_text", text: "hi!" },
        ]
      }
    );

    // const result = await client.testConnection();
    // console.log("Connection test result:", result);
    // const models = await client.getModels();
    // console.log("Available models:", models);

    const response = await client.responsesCreate("gpt-5-mini", conversation.toOpenAIRequestInputs());
    console.log("Response from OpenAI:", JSON.stringify(response, null, 2));

    conversation.addOutputs(response.output);
    conversation.addInput(
      {
        role   : "user",
        content: [
          { type: "input_text", text: "Tell me a joke about cats." },
        ]
      }
    );

    console.log("Conversation so far:", JSON.stringify(conversation.toOpenAIRequestInputs(), null, 2));

    const response2 = await client.responsesCreate("gpt-5-mini", conversation.toOpenAIRequestInputs());

    console.log("Response from OpenAI:", JSON.stringify(response2, null, 2));


  });

  it("function call of OpenAIClient", async () => {
    // Test implementation
    const client = new OpenAIClient("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", "https://api.openai.com/v1");

    const conversation = new OpenAIConversation();

    conversation.addInput(
      {
        role   : "system", 
        content: [ {type: "input_text", text: "you are a helpful assistant that provides weather information."} ]
      },
    );
    conversation.addInput(
      {
        role   : "user",
        content: [ { type: "input_text", text: "today's tokyo and osaka weather?" } ]
      }
    );

    // const result = await client.testConnection();
    // console.log("Connection test result:", result);
    // const models = await client.getModels();
    // console.log("Available models:", models);

    const getWeatherTool = new OpenAITool({
      name       : "get_weather",
      description: "Get location's weather",

      func_params: z.object({location: z.string()}),
      func       : (input) => {return `location ${input.location}'s weather is sun!`;}
    });
    const tools = new OpenAITools([getWeatherTool]);

    const response = await client.responsesCreate(
      "gpt-5-mini",
      conversation.toOpenAIRequestInputs(),
      tools.toOpenAIApiRawToolDefinitions(),
    );
    console.log("Response from OpenAI:", JSON.stringify(response, null, 2));

    conversation.addOutputs(response.output);

    const functionCalls = conversation.dumpFunctionCalls(response.output);
    const funcResult = tools.handleFunctionCalls(functionCalls || []);
    console.log("Function call results:", JSON.stringify(funcResult, null, 2));
    conversation.addInputs(funcResult);

    const response2 = await client.responsesCreate(
      "gpt-5-mini",
      conversation.toOpenAIRequestInputs(),
      tools.toOpenAIApiRawToolDefinitions(),
    );
    console.log("Response from OpenAI:", JSON.stringify(response2, null, 2));
    conversation.addOutputs(response2.output);

    console.log("Final conversation:", JSON.stringify(conversation.toOpenAIRequestInputs(), null, 2));
    // conversation.addOutputs(response.output);
    // conversation.addInput(
    //   {
    //     role   : "user",
    //     content: [
    //       { type: "input_text", text: "Tell me a joke about cats." },
    //     ]
    //   }
    // );

    // console.log("Conversation so far:", JSON.stringify(conversation.toOpenAIRequestInputs(), null, 2));

    // const response2 = await client.responsesCreate("gpt-5-mini", conversation.toOpenAIRequestInputs());

    // console.log("Response from OpenAI:", JSON.stringify(response2, null, 2));


  });
  it("streaming test", async () => {
    // Test implementation
    const client = new OpenAIClient("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", "https://api.openai.com/v1");

    const conversation = new OpenAIConversation();

    conversation.addInput(
      {
        role   : "user",
        content: [
          { type: "input_text", text: "hi!" },
        ]
      }
    );

    // const result = await client.testConnection();
    // console.log("Connection test result:", result);
    // const models = await client.getModels();
    // console.log("Available models:", models);

    const stream = await client.responsesCreateStream("gpt-4o-mini", conversation.toOpenAIRequestInputs());

    for await (const event of stream) {
      console.log("Event:", JSON.stringify(event, null, 2));
    }
  });

  it("function call of OpenAIClient stream", async () => {
    // Test implementation
    const client = new OpenAIClient("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", "https://api.openai.com/v1");

    const conversation = new OpenAIConversation();

    conversation.addInput(
      {
        role   : "system", 
        content: [ {type: "input_text", text: "you are a helpful assistant that provides weather information."} ]
      },
    );
    conversation.addInput(
      {
        role   : "user",
        content: [ { type: "input_text", text: "today's tokyo and osaka weather?" } ]
      }
    );

    // const result = await client.testConnection();
    // console.log("Connection test result:", result);
    // const models = await client.getModels();
    // console.log("Available models:", models);

    const getWeatherTool = new OpenAITool({
      name       : "get_weather",
      description: "Get location's weather",

      func_params: z.object({location: z.string()}),
      func       : (input) => {return `location ${input.location}'s weather is sun!`;}
    });
    const tools = new OpenAITools([getWeatherTool]);

    const response = await client.responsesCreateStream(
      "gpt-5-mini",
      conversation.toOpenAIRequestInputs(),
      tools.toOpenAIApiRawToolDefinitions(),
    );
    // console.log("Response from OpenAI:", JSON.stringify(response, null, 2));

    for await (const event of response) {
      console.log("Event:", JSON.stringify(event));
      console.log("\n");
    }

    // conversation.addOutputs(response.output);

    // const functionCalls = conversation.dumpFunctionCalls(response.output);
    // const funcResult = tools.handleFunctionCalls(functionCalls || []);
    // console.log("Function call results:", JSON.stringify(funcResult, null, 2));
    // conversation.addInputs(funcResult);

    // const response2 = await client.responsesCreate(
    //   "gpt-5-mini",
    //   conversation.toOpenAIRequestInputs(),
    //   tools.toOpenAIApiRawToolDefinitions(),
    // );
    // console.log("Response from OpenAI:", JSON.stringify(response2, null, 2));
    // conversation.addOutputs(response2.output);

    // console.log("Final conversation:", JSON.stringify(conversation.toOpenAIRequestInputs(), null, 2));
    // conversation.addOutputs(response.output);
    // conversation.addInput(
    //   {
    //     role   : "user",
    //     content: [
    //       { type: "input_text", text: "Tell me a joke about cats." },
    //     ]
    //   }
    // );

    // console.log("Conversation so far:", JSON.stringify(conversation.toOpenAIRequestInputs(), null, 2));

    // const response2 = await client.responsesCreate("gpt-5-mini", conversation.toOpenAIRequestInputs());

    // console.log("Response from OpenAI:", JSON.stringify(response2, null, 2));


  });
});
