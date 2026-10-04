const TECHNICAL = /graphql|status code|500|502|503|network request failed|failed to fetch|unexpected token|econn|timeout/i;

/** User-facing copy. Technical messages never reach the screen. */
export function toFriendlyError(error: unknown, fallback: string): string {
  const message = readMessage(error);
  if (!message || TECHNICAL.test(message) || message.length > 140) return fallback;
  return message;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return '';
}
