export const CLIENT_CONFIRM_COPY = {
  push: {
    title: { en: 'Your order has arrived', fr: 'Votre commande est arrivée' },
    body: {
      en: 'Tap to confirm you received it.',
      fr: 'Touchez pour confirmer la réception.',
    },
  },
  cta: {
    confirm: { en: 'Confirm receipt', fr: 'Confirmer la réception' },
    problem: { en: 'Report a problem', fr: 'Signaler un problème' },
  },
  confirmDone: {
    en: 'Thanks! Your order is complete.',
    fr: 'Merci ! Votre commande est terminée.',
  },
  agentWaiting: {
    en: 'Waiting for the client to confirm',
    fr: 'En attente de la confirmation du client',
  },
  agentFallbackCta: {
    en: 'Client couldn\'t confirm',
    fr: 'Le client n\'a pas pu confirmer',
  },
  agentFallbackPhoto: {
    en: 'Take a photo of the delivered order',
    fr: 'Prenez une photo de la commande livrée',
  },
  agentFallbackDone: {
    en: 'Submitted. Order completes automatically in {h}h unless the client reports a problem.',
    fr: 'Envoyé. La commande sera terminée automatiquement dans {h} h sauf si le client signale un problème.',
  },
  clientFallbackNotice: {
    en: 'Your courier marked this order delivered with a photo. Confirm or report a problem within {h}h.',
    fr: 'Votre livreur a indiqué que la commande est livrée, photo à l\'appui. Confirmez ou signalez un problème dans les {h} h.',
  },
  agentNonStripe: {
    en: 'Waiting for the client. Contact support if needed.',
    fr: 'En attente du client. Contactez le support si besoin.',
  },
  payReceivedNext: {
    en: 'Payment received. Ask the client to confirm receipt in the app.',
    fr: 'Paiement reçu. Demandez au client de confirmer la réception dans l\'application.',
  },
  giftWa: {
    en: 'Hi {name}, {sender} sent you an order via Rendasua. Did you receive it?',
    fr: 'Bonjour {name}, {sender} vous a envoyé une commande via Rendasua. L\'avez-vous reçue ?',
  },
  giftQrYes: { en: 'Received', fr: 'Reçu' },
  giftQrNo: { en: 'Problem', fr: 'Problème' },
} as const;

export function withHours(template: string, hours: number): string {
  return template.replace(/\{h\}/g, String(hours));
}
