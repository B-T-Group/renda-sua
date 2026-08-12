export const AGENT_FOCUS_VALUES = ['delivery', 'commercial', 'both'] as const;

export type AgentFocus = (typeof AGENT_FOCUS_VALUES)[number];

export function normalizeAgentFocus(value: unknown): AgentFocus {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'delivery' || raw === 'commercial' || raw === 'both') {
    return raw;
  }
  return 'both';
}

export function showsDeliveryChrome(focus: unknown): boolean {
  const f = normalizeAgentFocus(focus);
  return f === 'delivery' || f === 'both';
}

export function showsCommercialChrome(focus: unknown): boolean {
  const f = normalizeAgentFocus(focus);
  return f === 'commercial' || f === 'both';
}
