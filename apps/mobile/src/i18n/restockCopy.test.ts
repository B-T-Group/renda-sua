import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

const EN = en.restockAlerts as Record<string, string>;
const FR = fr.restockAlerts as Record<string, string>;

describe('restock alerts copy (#343 §6)', () => {
  it('matches the spec EN strings', () => {
    expect(EN.bellOn).toBe("We'll tell you when it's back");
    expect(EN.bellOff).toBe("Notify me when it's back");
    expect(EN.hint).toBe("We'll let you know when it's back.");
    expect(EN.alertOn).toBe('Alert on');
    expect(EN.alertOff).toBe('Alert off');
    expect(EN.undo).toBe('Undo');
    expect(EN.backInStock).toBe('Back in stock');
    expect(EN.goneAgain).toBe("Gone again. We'll tell you next time.");
    expect(EN.emptyBackInStock).toBe("Nothing back yet. We'll tell you.");
    expect(EN.settingsTitle).toBe('Restock alerts');
    expect(EN.settingsSubtitle).toBe('Items you liked that come back in stock');
    expect(EN.bellAccessibilityOn).toBe('Restock alert for {{item}}: on');
    expect(EN.bellAccessibilityOff).toBe('Restock alert for {{item}}: off');
    expect(EN.stopAction).toBe('Stop restock alerts');
  });

  it('matches the spec FR strings', () => {
    expect(FR.bellOn).toBe('Nous vous prévenons à son retour');
    expect(FR.bellOff).toBe('Me prévenir à son retour');
    expect(FR.hint).toBe('Nous vous prévenons à son retour.');
    expect(FR.alertOn).toBe('Alerte activée');
    expect(FR.alertOff).toBe('Alerte désactivée');
    expect(FR.undo).toBe('Annuler');
    expect(FR.backInStock).toBe('De retour');
    expect(FR.goneAgain).toBe('Déjà épuisé. Nous vous prévenons au prochain retour.');
    expect(FR.emptyBackInStock).toBe("Rien de retour pour l'instant. Nous vous prévenons.");
    expect(FR.settingsTitle).toBe('Alertes de retour en stock');
    expect(FR.settingsSubtitle).toBe('Articles aimés qui reviennent en stock');
    expect(FR.bellAccessibilityOn).toBe('Alerte de retour pour {{item}} : activée');
    expect(FR.bellAccessibilityOff).toBe('Alerte de retour pour {{item}} : désactivée');
    expect(FR.stopAction).toBe('Arrêter les alertes');
  });

  it('has the same keys in EN and FR and no banned words', () => {
    expect(Object.keys(FR).sort()).toEqual(Object.keys(EN).sort());
    const all = [...Object.values(EN), ...Object.values(FR)].join(' ').toLowerCase();
    for (const banned of ['price', 'waitlist', 'subscription', 'queue', 'prix', 'abonnement', "liste d'attente", 'file d']) {
      expect(all).not.toContain(banned);
    }
  });
});
