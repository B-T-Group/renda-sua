import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

describe('agentOrder copy keys', () => {
  it('has the locked EN strings', () => {
    expect(en.agentOrder.more.a11y).toBe('More actions');
    expect(en.agentOrder.more.runningLate).toBe("I'm running late");
    expect(en.agentOrder.more.release).toBe('Release order');
    expect(en.agentOrder.more.reportIssue).toBe('Report a problem');
    expect(en.agentOrder.release.confirmTitle).toBe('Release this order?');
    expect(en.agentOrder.release.confirmBody).toBe(
      "It will go back to other agents. You won't be able to deliver it."
    );
    expect(en.agentOrder.release.confirmCta).toBe('Release');
    expect(en.agentOrder.release.cancel).toBe('Keep order');
    expect(en.agentOrder.urgency.pickupBy).toBe('Pick up by {{time}}');
    expect(en.agentOrder.urgency.deliverBy).toBe('Deliver by {{time}}');
    expect(en.agentOrder.urgency.overdue).toBe('Late by {{duration}}');
    expect(en.agentOrder.urgency.durationMinutes).toBe('{{mins}}m');
    expect(en.agentOrder.urgency.durationHours).toBe('{{hours}}h');
  });

  it('has the locked FR vous strings', () => {
    expect(fr.agentOrder.more.a11y).toBe("Plus d'actions");
    expect(fr.agentOrder.more.runningLate).toBe('Je suis en retard');
    expect(fr.agentOrder.more.release).toBe('Libérer la commande');
    expect(fr.agentOrder.more.reportIssue).toBe('Signaler un problème');
    expect(fr.agentOrder.release.confirmTitle).toBe('Libérer cette commande ?');
    expect(fr.agentOrder.release.confirmBody).toBe(
      'Elle sera proposée à d\'autres livreurs. Vous ne pourrez plus la livrer.'
    );
    expect(fr.agentOrder.release.confirmCta).toBe('Libérer');
    expect(fr.agentOrder.release.cancel).toBe('Garder la commande');
    expect(fr.agentOrder.urgency.pickupBy).toBe('À récupérer avant {{time}}');
    expect(fr.agentOrder.urgency.deliverBy).toBe('À livrer avant {{time}}');
    expect(fr.agentOrder.urgency.overdue).toBe('En retard de {{duration}}');
    expect(fr.agentOrder.urgency.durationMinutes).toBe('{{mins}} min');
    expect(fr.agentOrder.urgency.durationHours).toBe('{{hours}} h');
  });
});
