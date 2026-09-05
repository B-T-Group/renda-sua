import type { EmailLocale } from './email-template-data';

export interface RecipientSmsContext {
  orderNumber: string;
  businessName?: string | null;
  payerName?: string | null;
  locale: EmailLocale;
}

function sender(ctx: RecipientSmsContext): string {
  const name = ctx.payerName?.trim();
  if (name) return name;
  return ctx.locale === 'fr' ? 'un proche' : 'someone you know';
}

/** Sent when a diaspora order is placed for this recipient. */
export function smsRecipientOrderPlaced(ctx: RecipientSmsContext): string {
  const store = ctx.businessName?.trim();
  if (ctx.locale === 'fr') {
    return `Rendasua: ${sender(ctx)} a commandé pour vous${
      store ? ` chez ${store}` : ''
    }. Commande ${ctx.orderNumber}. Vous recevrez le suivi et votre code de livraison ici.`;
  }
  return `Rendasua: ${sender(ctx)} placed an order for you${
    store ? ` at ${store}` : ''
  }. Order ${ctx.orderNumber}. You'll get tracking and your delivery code here.`;
}

/** Sent when the merchant confirms the order. */
export function smsRecipientOrderConfirmed(ctx: RecipientSmsContext): string {
  return ctx.locale === 'fr'
    ? `Rendasua: commande ${ctx.orderNumber} confirmée par le vendeur. Nous vous préviendrons dès qu'elle part.`
    : `Rendasua: order ${ctx.orderNumber} confirmed by the seller. We'll text you when it's on the way.`;
}

/** Sent when the order is ready to be collected in store. */
export function smsRecipientOrderReady(ctx: RecipientSmsContext): string {
  const store = ctx.businessName?.trim();
  return ctx.locale === 'fr'
    ? `Rendasua: commande ${ctx.orderNumber} prête à retirer${
        store ? ` chez ${store}` : ''
      }. Présentez votre code de retrait.`
    : `Rendasua: order ${ctx.orderNumber} is ready for pickup${
        store ? ` at ${store}` : ''
      }. Show your pickup code to collect it.`;
}

/** Sent when an agent is on the way to the recipient. */
export function smsRecipientOutForDelivery(ctx: RecipientSmsContext): string {
  return ctx.locale === 'fr'
    ? `Rendasua: commande ${ctx.orderNumber} en cours de livraison. Donnez votre code de livraison au livreur à la remise.`
    : `Rendasua: order ${ctx.orderNumber} is out for delivery. Give your delivery code to the agent on handover.`;
}

/** Sent once the recipient has the goods. */
export function smsRecipientOrderComplete(ctx: RecipientSmsContext): string {
  return ctx.locale === 'fr'
    ? `Rendasua: commande ${ctx.orderNumber} remise. Bonne réception !`
    : `Rendasua: order ${ctx.orderNumber} delivered. Enjoy!`;
}

/** Sent when the order will not arrive. */
export function smsRecipientOrderCancelled(ctx: RecipientSmsContext): string {
  return ctx.locale === 'fr'
    ? `Rendasua: commande ${ctx.orderNumber} annulée. ${sender(ctx)} a été prévenu.`
    : `Rendasua: order ${ctx.orderNumber} was cancelled. ${sender(ctx)} has been notified.`;
}

/** Carries the delivery PIN to a recipient who has no Rendasua account. */
export function smsRecipientDeliveryPin(
  ctx: RecipientSmsContext,
  pin: string
): string {
  return ctx.locale === 'fr'
    ? `Rendasua: votre code de livraison pour la commande ${ctx.orderNumber} est ${pin}. Communiquez-le uniquement au livreur à la remise.`
    : `Rendasua: your delivery code for order ${ctx.orderNumber} is ${pin}. Share it only with the agent at handover.`;
}
