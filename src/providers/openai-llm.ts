import OpenAI from "openai";
import { LLMProvider, ChatHistory } from "../providers";
import { TokenChunk } from "../types";

export class OpenAIChat implements LLMProvider {
  private openai = new OpenAI();
  private systemPrompt = `You are a helpful AI assistant in a voice conversation. Keep responses natural and conversational. Avoid markdown, bullet points, or special formatting. Speak numbers as words. Keep responses concise and flowing for speech.`;

  constructor(private model = "gpt-3.5-turbo") {}

  async *chat(messages: ChatHistory): AsyncIterable<TokenChunk> {
    const messagesWithSystem = [
      { role: "system" as const, content: this.systemPrompt },
      ...messages,
    ];

    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages: messagesWithSystem,
      stream: true,
      temperature: 0.7,
      max_tokens: 200,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield {
          token: delta.content,
          isFinal: false,
        };
      }
    }

    yield {
      token: "",
      isFinal: true,
    };
  }
}
