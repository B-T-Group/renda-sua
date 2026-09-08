import { whatsappOrderConfirmedMessage } from './whatsapp-order-confirmed.message';

describe('whatsappOrderConfirmedMessage', () => {
  it('prompts pickup merchants to mark ready in the app so the customer is notified', () => {
    expect(
      whatsappOrderConfirmedMessage({
        orderNumber: 'ORD-1',
        language: 'en',
        fulfillmentMethod: 'pickup',
      })
    ).toBe(
      'Order ORD-1 confirmed. When it is ready, open the Rendasua app and mark it as ready so the customer is notified.'
    );
  });

  it('prompts delivery merchants to mark ready for pickup in the app', () => {
    expect(
      whatsappOrderConfirmedMessage({
        orderNumber: 'ORD-2',
        language: 'en',
        fulfillmentMethod: 'delivery',
      })
    ).toBe(
      'Order ORD-2 confirmed. When it is ready, open the Rendasua app and mark it ready for pickup so a courier can collect it.'
    );
  });

  it('localizes pickup copy to French', () => {
    expect(
      whatsappOrderConfirmedMessage({
        orderNumber: 'ORD-3',
        language: 'fr',
        fulfillmentMethod: 'pickup',
      })
    ).toBe(
      "Commande ORD-3 confirmée. Une fois prête, ouvrez l'application Rendasua et marquez-la comme prête pour informer le client."
    );
  });

  it('localizes delivery copy to French', () => {
    expect(
      whatsappOrderConfirmedMessage({
        orderNumber: 'ORD-4',
        language: 'fr-FR',
        fulfillmentMethod: 'delivery',
      })
    ).toBe(
      "Commande ORD-4 confirmée. Une fois prête, ouvrez l'application Rendasua et marquez-la prête pour le retrait afin qu'un coursier puisse la récupérer."
    );
  });
});
