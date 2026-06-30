import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages } from "ai";
import { createWorkersAI } from "workers-ai-provider";

export class ChatAgent extends AIChatAgent {
  async onChatMessage(onFinish, options) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    
    // Read the active chart context passed from client options
    const clientData = options?.dataContext || {};
    const contextString = JSON.stringify(clientData);

    const result = streamText({
      model: workersai("@cf/meta/llama-3.1-8b-instruct-fp8"),
      system: `You are EuroMetrics AI, a professional macroeconomic analyst.
You help users interpret the eurozone economic indicators displayed on screen.

Active Chart Context:
${contextString}

Instructions:
- Explain what the active metrics represent.
- Provide analytical, math-grounded answers.
- MUST be extremely concise: answer in maximum 2 sentences (or 60 words).
- DO NOT use markdown formatting. Output plain text ONLY (no asterisks, headers, lists, or markdown bold/italics).`,
      messages: await convertToModelMessages(this.messages),
      abortSignal: options?.abortSignal,
      onFinish
    });

    return result.toUIMessageStreamResponse();
  }
}
