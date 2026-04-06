/** OpenAI-compatible chat completion payload/response (used with DeepSeek API). */

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  /** String, or multimodal parts: `{ type: 'text', text }` / `{ type: 'image_url', image_url: { url } }`. */
  content: unknown;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: unknown;
    };
  }>;
}
