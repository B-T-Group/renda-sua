export function whatsappOrderConfirmedMessage(params: {
  orderNumber: string;
  language?: string | null;
  fulfillmentMethod?: string | null;
}): string {
  const isFr = (params.language || '').toLowerCase().startsWith('fr');
  const isDelivery = params.fulfillmentMethod === 'delivery';
  if (isFr) {
    return isDelivery
      ? `Commande ${params.orderNumber} confirmée. Une fois prête, ouvrez l'application Rendasua et marquez-la prête pour le retrait afin qu'un coursier puisse la récupérer.`
      : `Commande ${params.orderNumber} confirmée. Une fois prête, ouvrez l'application Rendasua et marquez-la comme prête pour informer le client.`;
  }
  return isDelivery
    ? `Order ${params.orderNumber} confirmed. When it is ready, open the Rendasua app and mark it ready for pickup so a courier can collect it.`
    : `Order ${params.orderNumber} confirmed. When it is ready, open the Rendasua app and mark it as ready so the customer is notified.`;
}
