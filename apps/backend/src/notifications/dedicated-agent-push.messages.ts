import { normalizeLanguage } from './email-template-data';

/** #594 slot labels (AC v5 copy table). */
const SLOT_LABELS: Record<'en' | 'fr', Record<string, string>> = {
  en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
  fr: { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' },
};

export type DedicatedNoticeEvent = 'assigned' | 'paused' | 'resumed' | 'removed';

export function dedicatedSlotLabel(slotKey: string, preferredLanguage?: string | null): string {
  const locale = normalizeLanguage(preferredLanguage);
  return SLOT_LABELS[locale][slotKey] ?? slotKey;
}

/** "Morning" / "Morning, Evening" in the recipient's language. */
export function dedicatedSlotList(slotKeys: string[], preferredLanguage?: string | null): string {
  return slotKeys.map((k) => dedicatedSlotLabel(k, preferredLanguage)).join(', ');
}

/** Business owner / delegate: "RendaSua assigned {{agent}} to {{slot}}" (AC-S2, copy table). */
export function buildDedicatedAssignedBusinessMessage(params: {
  agentName: string;
  slotKeys: string[];
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotList(params.slotKeys, locale);
  if (locale === 'fr') {
    return {
      title: 'Livreur dédié',
      body: `RendaSua a affecté ${params.agentName} au créneau ${slot}`,
    };
  }
  return { title: 'Dedicated agent', body: `RendaSua assigned ${params.agentName} to ${slot}` };
}

/** Agent: assignment events for a store-slot ("You're now dedicated to {{store}} ({{slot}})"). */
export function buildDedicatedAgentMessage(params: {
  event: DedicatedNoticeEvent;
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
      case 'assigned':
        return { title, body: `Vous êtes désormais livreur dédié de ${store} (${slot})` };
      case 'paused':
        return { title, body: `${store} a mis en pause votre créneau dédié (${slot})` };
      case 'resumed':
        return { title, body: `${store} a réactivé votre créneau dédié (${slot})` };
      case 'removed':
        return { title, body: `${store} vous a retiré comme livreur dédié (${slot})` };
    }
  }
  const title = 'Dedicated agent';
  switch (params.event) {
    case 'assigned':
      return { title, body: `You're now dedicated to ${store} (${slot})` };
    case 'paused':
      return { title, body: `${store} paused your dedicated slot (${slot})` };
    case 'resumed':
      return { title, body: `${store} resumed your dedicated slot (${slot})` };
    case 'removed':
      return { title, body: `${store} removed you as a dedicated agent (${slot})` };
  }
}
