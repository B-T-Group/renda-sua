const FRENCH_COUNTRIES = new Set([
  'GA',
  'CM',
  'CI',
  'SN',
  'CD',
  'CG',
  'BJ',
  'TG',
]);

const COMPLETE_BUTTONS = new Set([
  'complete_order',
  'complete order',
  'terminer la commande',
  'terminer_la_commande',
]);

export type RecipientCompleteOutcome =
  | 'completed'
  | 'already_complete'
  | 'not_allowed'
  | 'unmatched'
  | 'failed';

type ReplyLocale = 'en' | 'fr';

const REPLIES: Record<RecipientCompleteOutcome, Record<ReplyLocale, string>> = {
  completed: {
    en: 'Order {{orderNumber}} is complete. The store has been paid.',
    fr: 'La commande {{orderNumber}} est terminée. Le magasin a été payé.',
  },
  already_complete: {
    en: 'Order {{orderNumber}} is already complete.',
    fr: 'La commande {{orderNumber}} est déjà terminée.',
  },
  not_allowed: {
    en: 'This order cannot be completed from WhatsApp. Ask the person who placed it to complete it in the app.',
    fr: "Cette commande ne peut pas être terminée sur WhatsApp. Demandez à la personne qui l'a passée de la terminer dans l'application.",
  },
  unmatched: {
    en: 'We could not match this button to an order. Ask the person who placed the order to complete it in the app.',
    fr: "Nous n'avons pas pu associer ce bouton à une commande. Demandez à la personne qui l'a passée de la terminer dans l'application.",
  },
  failed: {
    en: 'Order {{orderNumber}} could not be completed. Ask the person who placed it to complete it in the app.',
    fr: "La commande {{orderNumber}} n'a pas pu être terminée. Demandez à la personne qui l'a passée de la terminer dans l'application.",
  },
};

export function canRecipientCompletePickup(order: {
  is_diaspora_order?: boolean | null;
  fulfillment_method?: string | null;
  current_status?: string | null;
  payment_status?: string | null;
}): boolean {
  if (order.is_diaspora_order !== true) return false;
  if (order.fulfillment_method !== 'pickup') return false;
  if (order.current_status !== 'ready_for_pickup') return false;
  const payment = order.payment_status;
  return payment === 'paid' || payment === 'authorized';
}

export function isRecipientCompleteButton(
  buttonId?: string,
  buttonTitle?: string
): boolean {
  const id = (buttonId || '').trim().toLowerCase();
  const title = (buttonTitle || '').trim().toLowerCase();
  return COMPLETE_BUTTONS.has(id) || COMPLETE_BUTTONS.has(title);
}

export function recipientCompleteLocale(country?: string | null): ReplyLocale {
  const code = country?.trim().toUpperCase();
  return code && FRENCH_COUNTRIES.has(code) ? 'fr' : 'en';
}

export function recipientCompleteReply(
  outcome: RecipientCompleteOutcome,
  locale: ReplyLocale,
  orderNumber?: string | null
): string {
  return REPLIES[outcome][locale].replace(
    '{{orderNumber}}',
    orderNumber?.trim() || ''
  );
}
