import type { EmailLocale } from './email-template-data';

export function smsOrderDelivered(
  orderNumber: string,
  locale: EmailLocale
): string {
  return locale === 'fr'
    ? `Rendasua: commande ${orderNumber} livrée. Merci !`
    : `Rendasua: order ${orderNumber} delivered. Thank you!`;
}

export function smsOrderComplete(
  orderNumber: string,
  locale: EmailLocale
): string {
  return locale === 'fr'
    ? `Rendasua: commande ${orderNumber} terminée. Merci !`
    : `Rendasua: order ${orderNumber} complete. Thank you!`;
}

export function smsOrderCancelled(
  orderNumber: string,
  locale: EmailLocale
): string {
  return locale === 'fr'
    ? `Rendasua: commande ${orderNumber} annulée.`
    : `Rendasua: order ${orderNumber} cancelled.`;
}

export function smsPaymentFailed(
  orderNumber: string,
  locale: EmailLocale
): string {
  return locale === 'fr'
    ? `Rendasua: paiement refusé pour ${orderNumber}. Réessayez dans l'app.`
    : `Rendasua: payment failed for ${orderNumber}. Retry in the app.`;
}

export function smsFirstOrderShareCode(
  orderNumber: string,
  discountCode: string,
  locale: EmailLocale
): string {
  return locale === 'fr'
    ? `Rendasua: 1ère commande ${orderNumber} terminée. Code ${discountCode} pour un proche sur la suivante.`
    : `Rendasua: first order ${orderNumber} done. Share code ${discountCode} with a friend for their next order.`;
}
