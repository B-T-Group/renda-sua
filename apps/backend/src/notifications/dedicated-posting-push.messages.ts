import { dedicatedSlotList } from './dedicated-agent-push.messages';
import { normalizeLanguage } from './email-template-data';

/** #594 PR 7 posting notices. Agent: accepted / filled / closed / terms_updated (A1c, A3). Business: new_application (B16). */
export type DedicatedPostingAgentEvent = 'accepted' | 'filled' | 'closed' | 'terms_updated';

export function buildDedicatedPostingAgentMessage(params: {
  event: DedicatedPostingAgentEvent;
  storeName: string;
  slotKeys: string[];
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotList(params.slotKeys, locale);
  const store = params.storeName;
  if (locale === 'fr') {
    const title = 'Livreur dédié';
    switch (params.event) {
      case 'accepted':
        return { title, body: `${store} vous a accepté comme livreur dédié (${slot})` };
      case 'filled':
        return { title, body: `Ce poste a été pourvu : ${store} (${slot})` };
      case 'closed':
        return { title, body: `${store} ne recherche plus de livreur dédié (${slot})` };
      case 'terms_updated':
        return { title, body: `${store} a mis à jour ses conditions` };
    }
  }
  const title = 'Dedicated agent';
  switch (params.event) {
    case 'accepted':
      return { title, body: `${store} accepted you as its dedicated agent (${slot})` };
    case 'filled':
      return { title, body: `This spot was filled: ${store} (${slot})` };
    case 'closed':
      return { title, body: `${store} is no longer looking for a dedicated agent (${slot})` };
    case 'terms_updated':
      return { title, body: `${store} updated its terms` };
  }
}

/** AC-P13: a new posting near the agent, in slots they all prefer. */
export function buildDedicatedPostingCreatedMessage(params: {
  storeName: string;
  slotKeys: string[];
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotList(params.slotKeys, locale);
  if (locale === 'fr') {
    return { title: 'Nouveau poste dédié', body: `${params.storeName} recherche un livreur dédié (${slot})` };
  }
  return { title: 'New dedicated spot', body: `${params.storeName} is looking for a dedicated agent (${slot})` };
}

/** Business owner / managing delegates: a new applicant (AC-B16). */
export function buildDedicatedPostingApplicationMessage(params: {
  agentFirstName: string;
  slotKeys: string[];
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotList(params.slotKeys, locale);
  if (locale === 'fr') {
    return { title: 'Nouvelle candidature', body: `${params.agentFirstName} a postulé comme livreur dédié (${slot})` };
  }
  return { title: 'New applicant', body: `${params.agentFirstName} applied to be your dedicated agent (${slot})` };
}
