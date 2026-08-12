export const AGENT_FOCUS_VALUES = ['delivery', 'commercial', 'both'] as const;
export type AgentFocus = (typeof AGENT_FOCUS_VALUES)[number];

export function normalizeAgentFocus(value: unknown): AgentFocus {
  if (value === 'delivery' || value === 'commercial' || value === 'both') {
    return value;
  }
  return 'both';
}

export function showsDeliveryChrome(focus: AgentFocus | null | undefined): boolean {
  const f = normalizeAgentFocus(focus);
  return f === 'delivery' || f === 'both';
}

export function showsCommercialChrome(
  focus: AgentFocus | null | undefined
): boolean {
  const f = normalizeAgentFocus(focus);
  return f === 'commercial' || f === 'both';
}
