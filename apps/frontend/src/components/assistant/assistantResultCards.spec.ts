import { textBesideCards, type AssistantResultCard } from './assistantResultCards';

const card: AssistantResultCard = { kind: 'order', id: 'o1', title: 'Jus Oasis' };

describe('textBesideCards', () => {
  it('keeps the sentence and drops the listed rows', () => {
    const text = 'Voici vos commandes récentes :\n1. **Commande n° 1**\n- **Total:** 200 XAF';
    expect(textBesideCards(text, [card])).toBe('Voici vos commandes récentes :');
  });

  it('leaves the reply unchanged when there are no cards', () => {
    expect(textBesideCards('1. Keep this')).toBe('1. Keep this');
  });
});
