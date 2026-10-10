import { describe, expect, it } from 'vitest';
import { textBesideCards, type AssistantResultCard } from './assistantResultCards';

const card: AssistantResultCard = { kind: 'order', id: 'o1', title: 'Jus Oasis' };

describe('textBesideCards', () => {
  it('keeps the sentence and drops the listed rows', () => {
    const text = [
      'Voici vos commandes récentes :',
      '1. **Commande n° 32261431**',
      '- **Total:** 200 XAF',
      '- **Article:** Jus Oasis',
      '',
      "Pour plus de détails, veuillez consulter l'application.",
    ].join('\n');
    expect(textBesideCards(text, [card])).toBe(
      "Voici vos commandes récentes :\n\nPour plus de détails, veuillez consulter l'application."
    );
  });

  it('leaves the reply unchanged when there are no cards', () => {
    expect(textBesideCards('1. Keep this', [])).toBe('1. Keep this');
  });
});
