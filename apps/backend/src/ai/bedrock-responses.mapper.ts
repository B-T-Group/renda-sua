import type { ChatCompletionMessage } from './chat-completion.types';

export type BedrockReasoningEffort =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export type BedrockResponsesInputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };

export type BedrockResponsesInputMessage = {
  role: 'user' | 'assistant';
  content: string | BedrockResponsesInputPart[];
};

export type BedrockResponsesRequestBody = {
  model: string;
  instructions?: string;
  input: string | BedrockResponsesInputMessage[];
  max_output_tokens?: number;
  temperature?: number;
  store: false;
  reasoning?: { effort: BedrockReasoningEffort };
  text?: { format: { type: 'json_object' } };
};

/**
 * Map OpenAI-style chat messages to Bedrock Mantle Responses API shape.
 * System messages become `instructions`; user/assistant become `input`.
 */
export function mapChatMessagesToResponses(input: {
  model: string;
  messages: ChatCompletionMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonObject?: boolean;
  reasoningEffort?: BedrockReasoningEffort;
}): BedrockResponsesRequestBody {
  const instructions = extractInstructions(input.messages);
  const responsesInput = mapNonSystemMessages(input.messages);
  const body: BedrockResponsesRequestBody = {
    model: input.model,
    input: responsesInput.length === 1 && typeof responsesInput[0].content === 'string'
      ? [
          {
            role: responsesInput[0].role,
            content: responsesInput[0].content,
          },
        ]
      : responsesInput,
    store: false,
  };
  if (instructions) body.instructions = instructions;
  if (input.maxTokens != null) body.max_output_tokens = input.maxTokens;
  if (input.temperature != null) body.temperature = input.temperature;
  if (input.reasoningEffort) {
    body.reasoning = { effort: input.reasoningEffort };
  }
  if (input.jsonObject) {
    body.text = { format: { type: 'json_object' } };
  }
  return body;
}

export function extractOutputText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const rec = response as Record<string, unknown>;
  if (typeof rec.output_text === 'string') {
    return stripCodeFences(rec.output_text);
  }
  if (!Array.isArray(rec.output)) return '';
  const chunks: string[] = [];
  for (const item of rec.output) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (entry.type === 'message' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (!part || typeof part !== 'object') continue;
        const p = part as Record<string, unknown>;
        if (
          (p.type === 'output_text' || p.type === 'text') &&
          typeof p.text === 'string'
        ) {
          chunks.push(p.text);
        }
      }
    }
  }
  return stripCodeFences(chunks.join('\n'));
}

export function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

function extractInstructions(messages: ChatCompletionMessage[]): string {
  return messages
    .filter((m) => m.role === 'system')
    .map((m) => contentToPlainText(m.content))
    .filter(Boolean)
    .join('\n\n');
}

function mapNonSystemMessages(
  messages: ChatCompletionMessage[]
): BedrockResponsesInputMessage[] {
  const out: BedrockResponsesInputMessage[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    out.push({
      role,
      content: mapContent(message.content),
    });
  }
  if (out.length === 0) {
    out.push({ role: 'user', content: '' });
  }
  return out;
}

function mapContent(
  content: unknown
): string | BedrockResponsesInputPart[] {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  const parts: BedrockResponsesInputPart[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const rec = part as Record<string, unknown>;
    if (rec.type === 'text' && typeof rec.text === 'string') {
      parts.push({ type: 'input_text', text: rec.text });
      continue;
    }
    if (rec.type === 'image_url') {
      const url = extractImageUrl(rec.image_url);
      if (url) parts.push({ type: 'input_image', image_url: url });
    }
  }
  return parts.length ? parts : contentToPlainText(content);
}

function extractImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl === 'string' && imageUrl.trim()) return imageUrl.trim();
  if (imageUrl && typeof imageUrl === 'object') {
    const url = (imageUrl as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

function contentToPlainText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const rec = part as Record<string, unknown>;
      return typeof rec.text === 'string' ? rec.text : '';
    })
    .filter(Boolean)
    .join('\n');
}
