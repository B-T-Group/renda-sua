/** OpenAI-compatible chat completion payload/response (used with DeepSeek API). */

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
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
