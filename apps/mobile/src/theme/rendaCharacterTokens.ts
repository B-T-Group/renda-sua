/**
 * Renda character palette. Brand-fixed solid colours (no gradients): the same
 * hexes in light and dark mode. Mirrors the web tokens
 * (`apps/frontend/src/components/assistant/rendaCharacterTokens.ts`).
 */
export const rendaCharacterTokens = {
  /** Body: a solid blue jelly blob. */
  blue: '#2F6BFF',
  /** Thinking: the body crossfades to violet. */
  violet: '#8B5CF6',
  /** Success motes. */
  mote: '#8FB4FF',
  eye: '#FFFFFF',
  highlight: '#FFFFFF',
} as const;

export type RendaCharacterTokens = typeof rendaCharacterTokens;
