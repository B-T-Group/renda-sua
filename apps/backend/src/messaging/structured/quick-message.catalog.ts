import type { PersonaId } from '../../users/persona.types';
import type { MessagingOrder } from '../messaging.types';

export type QuickMessageTemplateId =
  | 'agent_arrived'
  | 'client_unreachable'
  | 'on_my_way'
  | 'running_late_to_client'
  | 'client_coming_down'
  | 'client_call_me'
  | 'order_ready_for_pickup'
  | 'need_client_contact';

export type QuickMessageFulfillment = 'delivery' | 'pickup' | 'any';

export interface QuickMessageTemplate {
  id: QuickMessageTemplateId;
  allowedSenderPersonas: PersonaId[];
  allowedStatuses: string[];
  fulfillment: QuickMessageFulfillment;
  /** Static tag personas; overridden when resolveTagPersonas is set. */
  tagPersonas: PersonaId[];
  resolveTagPersonas?: (order: MessagingOrder) => PersonaId[];
  i18nKey: string;
  defaultMessageEn: string;
  defaultMessageFr: string;
  buttonLabelKey: string;
  buttonLabelEn: string;
  buttonLabelFr: string;
  /** Minimum ms between sends of this template for the same order. */
  rateLimitMs: number;
}

const ONE_MINUTE = 60_000;

export const QUICK_MESSAGE_TEMPLATES: QuickMessageTemplate[] = [
  {
    id: 'agent_arrived',
    allowedSenderPersonas: ['agent'],
    allowedStatuses: ['out_for_delivery'],
    fulfillment: 'delivery',
    tagPersonas: ['client'],
    i18nKey: 'orders.quickMessages.agentArrived.body',
    defaultMessageEn: "I've arrived at your location",
    defaultMessageFr: 'Je suis arrivé à votre adresse',
    buttonLabelKey: 'orders.quickMessages.agentArrived.button',
    buttonLabelEn: "I've arrived",
    buttonLabelFr: 'Je suis arrivé',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'client_unreachable',
    allowedSenderPersonas: ['agent'],
    allowedStatuses: ['out_for_delivery'],
    fulfillment: 'delivery',
    tagPersonas: ['client', 'business'],
    i18nKey: 'orders.quickMessages.clientUnreachable.body',
    defaultMessageEn: 'Unable to reach the client',
    defaultMessageFr: 'Impossible de joindre le client',
    buttonLabelKey: 'orders.quickMessages.clientUnreachable.button',
    buttonLabelEn: 'Client unreachable',
    buttonLabelFr: 'Client injoignable',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'on_my_way',
    allowedSenderPersonas: ['agent'],
    allowedStatuses: ['picked_up', 'in_transit'],
    fulfillment: 'delivery',
    tagPersonas: ['client'],
    i18nKey: 'orders.quickMessages.onMyWay.body',
    defaultMessageEn: "I'm on my way with your order",
    defaultMessageFr: 'Je suis en route avec votre commande',
    buttonLabelKey: 'orders.quickMessages.onMyWay.button',
    buttonLabelEn: 'On my way',
    buttonLabelFr: 'En route',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'running_late_to_client',
    allowedSenderPersonas: ['agent'],
    allowedStatuses: ['in_transit', 'out_for_delivery'],
    fulfillment: 'delivery',
    tagPersonas: ['client'],
    i18nKey: 'orders.quickMessages.runningLateToClient.body',
    defaultMessageEn: 'Running a few minutes late',
    defaultMessageFr: 'Je suis en retard de quelques minutes',
    buttonLabelKey: 'orders.quickMessages.runningLateToClient.button',
    buttonLabelEn: 'Running late',
    buttonLabelFr: 'En retard',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'client_coming_down',
    allowedSenderPersonas: ['client'],
    allowedStatuses: ['out_for_delivery'],
    fulfillment: 'delivery',
    tagPersonas: ['agent'],
    i18nKey: 'orders.quickMessages.clientComingDown.body',
    defaultMessageEn: "I'm coming down / will meet you shortly",
    defaultMessageFr: 'Je descends / je vous rejoins sous peu',
    buttonLabelKey: 'orders.quickMessages.clientComingDown.button',
    buttonLabelEn: "I'm coming down",
    buttonLabelFr: 'Je descends',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'client_call_me',
    allowedSenderPersonas: ['client'],
    allowedStatuses: ['picked_up', 'in_transit', 'out_for_delivery'],
    fulfillment: 'delivery',
    tagPersonas: ['agent'],
    i18nKey: 'orders.quickMessages.clientCallMe.body',
    defaultMessageEn: 'Please call me when you arrive',
    defaultMessageFr: 'Appelez-moi à votre arrivée',
    buttonLabelKey: 'orders.quickMessages.clientCallMe.button',
    buttonLabelEn: 'Please call me',
    buttonLabelFr: 'Appelez-moi',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'order_ready_for_pickup',
    allowedSenderPersonas: ['business'],
    allowedStatuses: ['ready_for_pickup'],
    fulfillment: 'any',
    tagPersonas: ['agent'],
    resolveTagPersonas: (order) => {
      if (order.assigned_agent?.user_id) return ['agent'];
      if (order.fulfillment_method === 'pickup' && order.client?.user_id) {
        return ['client'];
      }
      return [];
    },
    i18nKey: 'orders.quickMessages.orderReadyForPickup.body',
    defaultMessageEn: 'Order is ready for pickup',
    defaultMessageFr: 'La commande est prête à être récupérée',
    buttonLabelKey: 'orders.quickMessages.orderReadyForPickup.button',
    buttonLabelEn: 'Ready for pickup',
    buttonLabelFr: 'Prête pour retrait',
    rateLimitMs: ONE_MINUTE,
  },
  {
    id: 'need_client_contact',
    allowedSenderPersonas: ['business'],
    allowedStatuses: ['out_for_delivery', 'failed'],
    fulfillment: 'delivery',
    tagPersonas: ['client', 'agent'],
    i18nKey: 'orders.quickMessages.needClientContact.body',
    defaultMessageEn: 'Please help us reach the client',
    defaultMessageFr: 'Aidez-nous à joindre le client',
    buttonLabelKey: 'orders.quickMessages.needClientContact.button',
    buttonLabelEn: 'Need client contact',
    buttonLabelFr: 'Contacter le client',
    rateLimitMs: ONE_MINUTE,
  },
];

const BY_ID = new Map(
  QUICK_MESSAGE_TEMPLATES.map((t) => [t.id, t] as const)
);

export function getQuickMessageTemplate(
  templateId: string
): QuickMessageTemplate | undefined {
  return BY_ID.get(templateId as QuickMessageTemplateId);
}

export function resolveTemplateTagPersonas(
  template: QuickMessageTemplate,
  order: MessagingOrder
): PersonaId[] {
  if (template.resolveTagPersonas) {
    return template.resolveTagPersonas(order);
  }
  return template.tagPersonas;
}

export function isTemplateEligibleForOrder(
  template: QuickMessageTemplate,
  order: MessagingOrder,
  senderPersona: PersonaId
): boolean {
  if (!template.allowedSenderPersonas.includes(senderPersona)) return false;
  const status = order.current_status ?? '';
  if (!template.allowedStatuses.includes(status)) return false;
  if (template.fulfillment === 'delivery' && order.fulfillment_method === 'pickup') {
    return false;
  }
  if (template.fulfillment === 'pickup' && order.fulfillment_method !== 'pickup') {
    return false;
  }
  const tags = resolveTemplateTagPersonas(template, order);
  if (tags.length === 0) return false;
  return true;
}
