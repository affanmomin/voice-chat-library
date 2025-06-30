import OpenAI from "openai";
import { LLMProvider, ChatHistory } from "../providers";
import { TokenChunk } from "../types";

export class OpenAIChat implements LLMProvider {
  private openai = new OpenAI();
  private systemPrompt = `You are a helpful AI assistant in a voice conversation. Your responses will be converted to speech, so please follow these guidelines:

- Speak naturally and conversationally, as if talking to a friend
- Avoid all markdown formatting (no **bold**, *italic*, \`code\`, or # headers)
- Don't use bullet points, numbered lists, or special symbols
- Instead of lists, use natural speech like "First,", "Second,", "Another point is"
- Speak numbers and symbols as words (e.g., "percent" not "%", "dollars" not "$")
- Keep responses flowing and easy to listen to
- Use natural pauses with commas and periods
- Explain concepts clearly without visual formatting
- If mentioning steps or points, use conversational transitions

Remember: someone will be listening to this, not reading it. Make it sound natural and engaging when spoken aloud.`;

  constructor(private model = "gpt-4o-mini") {}

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
      max_tokens: 1000,
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
