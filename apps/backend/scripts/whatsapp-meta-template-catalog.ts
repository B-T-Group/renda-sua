/** Catalog matching apps/backend/docs/whatsapp-meta-templates.md plus Auth0 rs_login_code. */

export const TEMPLATE_LANGUAGES = ['en', 'fr'] as const;
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number];

export const BUTTON_URL_EXAMPLE = '550e8400-e29b-41d4-a716-446655440000';
export const AUTH_TTL_SECONDS = 600;

export type ContentTemplate = {
  kind: 'content';
  name: string;
  category: 'UTILITY' | 'MARKETING';
  body: Record<TemplateLanguage, string>;
  exampleValues: string[];
  /** Single URL CTA (legacy templates). */
  button?: {
    text: Record<TemplateLanguage, string>;
    url: string;
    dynamic: boolean;
  };
  /** Quick-reply buttons (merchant action templates). */
  quickReplies?: Array<{
    id: string;
    text: Record<TemplateLanguage, string>;
  }>;
};

export type AuthTemplate = {
  kind: 'auth';
  name: string;
  category: 'AUTHENTICATION';
  addSecurityRecommendation: true;
  messageSendTtlSeconds: number;
};

export type CatalogTemplate = ContentTemplate | AuthTemplate;

export type GraphButton = {
  type?: string;
  text?: string;
  url?: string;
  otp_type?: string;
  example?: string[];
};

export type GraphComponent = {
  type?: string;
  text?: string;
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
  buttons?: GraphButton[];
  example?: { body_text?: string[][] };
};

export type GraphTemplate = {
  id: string;
  name: string;
  language: string;
  status?: string;
  category?: string;
  components?: GraphComponent[];
  message_send_ttl_seconds?: number;
};

const APP = 'https://rendasua.com';

export const TEMPLATE_CATALOG: CatalogTemplate[] = [
  {
    kind: 'content',
    name: 'rs_order_created',
    category: 'UTILITY',
    exampleValues: ['ORD-1001', 'Jane Doe', '30 minutes'],
    button: {
      text: { en: 'Open order', fr: 'Ouvrir la commande' },
      url: `${APP}/app/orders/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua: you have a new marketplace order.

Order number: {{1}}
Customer name: {{2}}
Please confirm within {{3}} so the customer is not left waiting.

Tap below to open the order in Rendasua.`,
      fr: `Rendasua : vous avez une nouvelle commande marketplace.

Numéro de commande : {{1}}
Nom du client : {{2}}
Veuillez confirmer sous {{3}} pour ne pas faire attendre le client.

Appuyez ci-dessous pour ouvrir la commande dans Rendasua.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_order_action',
    category: 'UTILITY',
    exampleValues: ['ORD-1001', 'Jane Doe', '30 minutes'],
    quickReplies: [
      {
        id: 'confirm',
        text: { en: 'Confirm', fr: 'Confirmer' },
      },
      {
        id: 'busy',
        text: { en: 'Need more time', fr: 'Besoin de temps' },
      },
      {
        id: 'decline',
        text: { en: 'Decline', fr: 'Refuser' },
      },
    ],
    body: {
      en: `Rendasua: you have a new marketplace order.

Order number: {{1}}
Customer name: {{2}}
Please confirm within {{3}} so the customer is not left waiting.

Tap a button below to respond.`,
      fr: `Rendasua : vous avez une nouvelle commande marketplace.

Numéro de commande : {{1}}
Nom du client : {{2}}
Veuillez confirmer sous {{3}} pour ne pas faire attendre le client.

Appuyez sur un bouton ci-dessous pour répondre.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_delivery_offer',
    category: 'MARKETING',
    exampleValues: ['Bonapriso', '2.4'],
    button: {
      text: { en: 'View offer', fr: 'Voir l’offre' },
      url: `${APP}/app/deliveries/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua: a new delivery offer is available near you.

Pickup area: {{1}}
Distance from you: about {{2}} km.

Open the app soon to accept or decline this offer before it expires.`,
      fr: `Rendasua : une nouvelle offre de livraison est disponible près de vous.

Zone de récupération : {{1}}
Distance approximative : {{2}} km.

Ouvrez l’application rapidement pour accepter ou refuser cette offre avant qu’elle n’expire.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_order_status',
    category: 'UTILITY',
    exampleValues: ['ORD-1001', 'Confirmed'],
    button: {
      text: { en: 'View order', fr: 'Voir la commande' },
      url: `${APP}/app/orders/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua order update for you.

Your order {{1}} status is now: {{2}}.

Open the app for full details and next steps.`,
      fr: `Mise à jour de votre commande Rendasua.

Le statut de votre commande {{1}} est maintenant : {{2}}.

Ouvrez l’application pour voir les détails et la suite.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_order_ready',
    category: 'UTILITY',
    exampleValues: ['ORD-1001'],
    button: {
      text: { en: 'View order', fr: 'Voir la commande' },
      url: `${APP}/app/orders/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua: your order is ready for pickup.

Order number {{1}} can be collected now. Please come to the store or follow the pickup instructions in the app.

See you soon.`,
      fr: `Rendasua : votre commande est prête pour le retrait.

La commande {{1}} peut être récupérée maintenant. Rendez-vous au magasin ou suivez les instructions de retrait dans l’application.

À bientôt.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_rental_request',
    category: 'UTILITY',
    exampleValues: ['Electric drill', '12-14 Sep'],
    button: {
      text: { en: 'Review request', fr: 'Voir la demande' },
      url: `${APP}/app/rentals/requests/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua: you received a new rental request.

Item: {{1}}
Requested dates: {{2}}

Please review and respond in the app so the renter gets a timely answer.`,
      fr: `Rendasua : vous avez reçu une nouvelle demande de location.

Article : {{1}}
Dates demandées : {{2}}

Veuillez examiner et répondre dans l’application pour informer rapidement le locataire.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_verification',
    category: 'UTILITY',
    exampleValues: ['ID expired'],
    button: {
      text: { en: 'Open documents', fr: 'Voir les documents' },
      url: `${APP}/app/verification`,
      dynamic: false,
    },
    body: {
      en: `Rendasua: your account verification needs attention.

Reason: {{1}}

Please update your documents in the app so we can continue the review.`,
      fr: `Rendasua : votre vérification de compte nécessite une action.

Motif : {{1}}

Veuillez mettre à jour vos documents dans l’application afin que nous puissions poursuivre l’examen.`,
    },
  },
  authTemplate('rs_delivery_pin'),
  {
    kind: 'content',
    name: 'rs_pickup_reminder',
    category: 'UTILITY',
    exampleValues: ['ORD-1001', '6:00 PM'],
    button: {
      text: { en: 'View order', fr: 'Voir la commande' },
      url: `${APP}/app/orders/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua pickup reminder for your assigned order.

Order {{1}} should be picked up by {{2}}. Please head to the store if you have not already collected it.

Open the app for the order details.`,
      fr: `Rappel de récupération Rendasua pour votre commande assignée.

La commande {{1}} doit être récupérée avant {{2}}. Rendez-vous au magasin si vous ne l’avez pas encore prise.

Ouvrez l’application pour les détails de la commande.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_payment_failed',
    category: 'UTILITY',
    exampleValues: ['ORD-1001'],
    button: {
      text: { en: 'View order', fr: 'Voir la commande' },
      url: `${APP}/app/orders/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua could not complete a payment for your order.

Payment failed for order {{1}}. Please update your payment method or try again in the app so the order can proceed.

We are here if you need help.`,
      fr: `Rendasua n’a pas pu finaliser un paiement pour votre commande.

Le paiement a échoué pour la commande {{1}}. Veuillez mettre à jour votre moyen de paiement ou réessayer dans l’application pour que la commande puisse continuer.

Nous sommes disponibles si vous avez besoin d’aide.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_ai_proposal',
    category: 'UTILITY',
    exampleValues: ['Electric drill'],
    button: {
      text: { en: 'Review', fr: 'Examiner' },
      url: `${APP}/app/items/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua: an AI listing suggestion is ready for review.

Suggested listing for {{1}} is waiting in your business workspace. Please open the app to approve, edit, or dismiss it.

Thanks for selling with Rendasua.`,
      fr: `Rendasua : une suggestion de fiche IA est prête à être examinée.

La suggestion pour {{1}} attend dans votre espace commerçant. Ouvrez l’application pour l’approuver, la modifier ou la rejeter.

Merci de vendre avec Rendasua.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_admin_order_risk',
    category: 'UTILITY',
    exampleValues: [
      'ORD-1001',
      'Not confirmed by merchant',
      'Merchant Acme, call +237600000000, client Jane, 15000 XAF, 20 min left',
    ],
    button: {
      text: { en: 'Open order', fr: 'Ouvrir la commande' },
      url: `${APP}/app/admin/orders/{{1}}`,
      dynamic: true,
    },
    body: {
      en: `Rendasua: an order needs your intervention.

Order {{1}} is flagged as: {{2}}.
Details: {{3}}

Open the admin panel to contact the client, the business, or the agent.`,
      fr: `Rendasua : une commande nécessite votre intervention.

La commande {{1}} est signalée : {{2}}.
Détails : {{3}}

Ouvrez le panneau d’administration pour contacter le client, le commerçant ou le livreur.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_recipient_order_update',
    category: 'UTILITY',
    exampleValues: ['ORD-1001', 'Confirmed'],
    body: {
      en: `Rendasua order update.

Order {{1}} status: {{2}}.

You will get further updates here if anything changes.`,
      fr: `Mise à jour de commande Rendasua.

Statut de la commande {{1}} : {{2}}.

Vous recevrez d'autres mises à jour ici si quelque chose change.`,
    },
  },
  authTemplate('rs_login_code'),
  {
    kind: 'content',
    name: 'rs_rcpt_order_contact',
    category: 'UTILITY',
    exampleValues: ['John Smith', 'Douala Market', 'ORD-5001'],
    body: {
      en: `Rendasua: you are listed as the delivery contact for an order.

Order {{3}} from {{2}} was placed by {{1}}.
You will receive status updates and your delivery code on WhatsApp.`,
      fr: `Rendasua : vous êtes le contact de livraison pour une commande.

La commande {{3}} de {{2}} a été passée par {{1}}.
Vous recevrez les mises à jour de statut et votre code de livraison sur WhatsApp.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_rcpt_out_for_delivery',
    category: 'UTILITY',
    exampleValues: ['ORD-5001'],
    body: {
      en: `Rendasua delivery update.

Order {{1}} is out for delivery. Share your delivery code only with the Rendasua agent at handover.`,
      fr: `Mise à jour de livraison Rendasua.

La commande {{1}} est en cours de livraison. Partagez votre code de livraison uniquement avec le livreur Rendasua lors de la remise.`,
    },
  },
  {
    kind: 'content',
    name: 'rs_rcpt_ready_pickup',
    category: 'UTILITY',
    exampleValues: ['ORD-5001', 'Douala Market'],
    body: {
      en: `Rendasua pickup update.

Order {{1}} is ready for pickup at {{2}}. Present your pickup code when collecting.`,
      fr: `Mise à jour de retrait Rendasua.

La commande {{1}} est prête pour le retrait chez {{2}}. Présentez votre code de retrait lors de la récupération.`,
    },
  },
];

function authTemplate(name: string): AuthTemplate {
  return {
    kind: 'auth',
    name,
    category: 'AUTHENTICATION',
    addSecurityRecommendation: true,
    messageSendTtlSeconds: AUTH_TTL_SECONDS,
  };
}

export function catalogKey(name: string, language: string): string {
  return `${name}::${language}`;
}

export function buildCreatePayload(
  template: CatalogTemplate,
  language: TemplateLanguage
): Record<string, unknown> {
  if (template.kind === 'auth') return buildAuthCreatePayload(template, language);
  return buildContentCreatePayload(template, language);
}

export function buildUpdatePayload(
  template: CatalogTemplate,
  language: TemplateLanguage
): Record<string, unknown> {
  const created = buildCreatePayload(template, language);
  delete created.name;
  delete created.language;
  delete created.allow_category_change;
  return created;
}

function buildAuthCreatePayload(
  template: AuthTemplate,
  language: TemplateLanguage
): Record<string, unknown> {
  return {
    name: template.name,
    language,
    category: template.category,
    message_send_ttl_seconds: template.messageSendTtlSeconds,
    components: authComponents(template),
  };
}

function buildContentCreatePayload(
  template: ContentTemplate,
  language: TemplateLanguage
): Record<string, unknown> {
  return {
    name: template.name,
    language,
    category: template.category,
    parameter_format: 'POSITIONAL',
    allow_category_change: true,
    components: contentComponents(template, language),
  };
}

function authComponents(template: AuthTemplate): GraphComponent[] {
  return [
    { type: 'BODY', add_security_recommendation: template.addSecurityRecommendation },
    { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] },
  ];
}

function contentComponents(
  template: ContentTemplate,
  language: TemplateLanguage
): GraphComponent[] {
  const components: GraphComponent[] = [bodyComponent(template, language)];
  const buttons = buttonsComponent(template, language);
  if (buttons) components.push(buttons);
  return components;
}

function bodyComponent(
  template: ContentTemplate,
  language: TemplateLanguage
): GraphComponent {
  return {
    type: 'BODY',
    text: template.body[language],
    example: { body_text: [template.exampleValues] },
  };
}

function buttonsComponent(
  template: ContentTemplate,
  language: TemplateLanguage
): GraphComponent | null {
  if (template.quickReplies?.length) {
    return {
      type: 'BUTTONS',
      buttons: template.quickReplies.map((qr) => ({
        type: 'QUICK_REPLY',
        text: qr.text[language],
      })),
    };
  }
  if (!template.button) {
    return null;
  }
  return {
    type: 'BUTTONS',
    buttons: [urlButton(template, language)],
  };
}

function urlButton(
  template: ContentTemplate,
  language: TemplateLanguage
): GraphButton {
  const button = template.button!;
  const graphButton: GraphButton = {
    type: 'URL',
    text: button.text[language],
    url: button.url,
  };
  if (button.dynamic) graphButton.example = [BUTTON_URL_EXAMPLE];
  return graphButton;
}

export function shouldSkipStatus(status?: string): boolean {
  const statusCode = (status ?? '').toUpperCase();
  return statusCode === 'PENDING_DELETION' || statusCode === 'DELETED';
}

export function templateNeedsUpdate(
  existing: GraphTemplate,
  template: CatalogTemplate,
  language: TemplateLanguage
): boolean {
  if (template.kind === 'auth') return authNeedsUpdate(existing, template);
  return contentNeedsUpdate(existing, template, language);
}

function contentNeedsUpdate(
  existing: GraphTemplate,
  template: ContentTemplate,
  language: TemplateLanguage
): boolean {
  const components = existing.components ?? [];
  const body = findComponent(components, 'BODY');
  if (normalizeBody(body?.text ?? '') !== normalizeBody(template.body[language])) {
    return true;
  }
  return urlButtonNeedsUpdate(
    findComponent(components, 'BUTTONS')?.buttons ?? [],
    template,
    language
  );
}

function urlButtonNeedsUpdate(
  buttons: GraphButton[],
  template: ContentTemplate,
  language: TemplateLanguage
): boolean {
  if (template.quickReplies?.length) {
    if (buttons.length !== template.quickReplies.length) return true;
    return template.quickReplies.some((qr, i) => {
      const b = buttons[i];
      return (
        (b?.type ?? '').toUpperCase() !== 'QUICK_REPLY' ||
        (b?.text ?? '') !== qr.text[language]
      );
    });
  }
  const first = buttons[0];
  if (!first || !template.button) return true;
  return (
    (first.text ?? '') !== template.button.text[language] ||
    (first.url ?? '') !== template.button.url
  );
}

function authNeedsUpdate(existing: GraphTemplate, template: AuthTemplate): boolean {
  if ((existing.category ?? '').toUpperCase() !== 'AUTHENTICATION') return true;
  if (authTtlNeedsUpdate(existing, template)) return true;
  const components = existing.components ?? [];
  const footer = findComponent(components, 'FOOTER');
  if (footer?.code_expiration_minutes) return true;
  const body = findComponent(components, 'BODY');
  if (body?.add_security_recommendation === false) return true;
  return (findComponent(components, 'BUTTONS')?.buttons ?? []).length === 0;
}

function authTtlNeedsUpdate(existing: GraphTemplate, template: AuthTemplate): boolean {
  const ttl = existing.message_send_ttl_seconds;
  if (ttl == null) return false;
  return ttl !== template.messageSendTtlSeconds;
}

function findComponent(
  components: GraphComponent[],
  type: string
): GraphComponent | undefined {
  return components.find((item) => (item.type ?? '').toUpperCase() === type);
}

function normalizeBody(text: string): string {
  return text.replace(/\r\n/g, '\n').trim().replace(/\n{3,}/g, '\n\n');
}
