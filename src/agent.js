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
- Explain what the active metrics represent (e.g., Maastricht 10Y convergence yields, HICP inflation, corporate loan interest rates).
- Provide analytical, math-grounded answers. If yields or inflation are unusually high or low (e.g., Greece/Italy spreads vs Germany, or inflation vs the ECB's 2.0% target), highlight why.
- Keep responses professional, highly concise, and fully objective.
- Use markdown formatting for readability.`,
      messages: await convertToModelMessages(this.messages),
      abortSignal: options?.abortSignal,
      onFinish
    });

    return result.toUIMessageStreamResponse();
  }
}
