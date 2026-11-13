import { classifyRentalWords, shouldAskBuyOrRent } from './assistant-rental-intent';
import { resolveMonthDay, validateExclusiveRange } from './assistant-rental-dates';
import { sanitizeRentalModelText } from './assistant-rental-guard';

const TODAY = '2026-11-13';

/** Deterministic stand-in for the P1-QA-1 prompt set. A live Bedrock run is not executed here. */
const PROMPTS: Array<{ text: string; kind: string }> = [
  { text: 'I want to rent a hammer from 17th to 18th November', kind: 'rent' },
  { text: 'Je veux louer un marteau du 17 au 18 novembre', kind: 'rent' },
  { text: 'rent a drill tomorrow', kind: 'rent' },
  { text: 'louer une perceuse demain', kind: 'rent' },
  { text: 'a mixer this weekend', kind: 'rent' },
  { text: 'une bétonnière ce week-end', kind: 'rent' },
  { text: 'hire a ladder for Friday to Sunday', kind: 'rent' },
  { text: 'borrow a generator next Saturday', kind: 'rent' },
  { text: 'location de marteau', kind: 'rent' },
  { text: 'hammer from 17 to 18', kind: 'rent' },
  { text: 'rent a pressure washer today', kind: 'rent' },
  { text: 'louer un karcher aujourd hui', kind: 'rent' },
  { text: 'hire a concrete mixer Monday', kind: 'rent' },
  { text: 'borrow tools Saturday', kind: 'rent' },
  { text: 'rental of a ladder', kind: 'rent' },
  { text: 'I want to rent a generator', kind: 'rent' },
  { text: 'Je veux louer une échelle', kind: 'rent' },
  { text: 'location de bétonnière', kind: 'rent' },
  { text: 'can I rent a mixer', kind: 'rent' },
  { text: 'rent 2 drills Friday', kind: 'rent' },
  { text: 'louer à Douala demain', kind: 'rent' },
  { text: 'hire equipment for the weekend', kind: 'rent' },
  { text: 'borrow a hammer tomorrow', kind: 'rent' },
  { text: 'rent under 5000 tomorrow', kind: 'rent' },
  { text: 'I need to hire a drill', kind: 'rent' },
  { text: 'I need a drill', kind: 'ambiguous' },
  { text: "J'ai besoin d'une perceuse", kind: 'ambiguous' },
  { text: 'I need a hammer', kind: 'ambiguous' },
  { text: 'need a ladder', kind: 'ambiguous' },
  { text: 'I want a mixer', kind: 'ambiguous' },
  { text: 'une perceuse svp', kind: 'ambiguous' },
  { text: 'I want to buy a hammer', kind: 'buy' },
  { text: 'Je veux acheter un marteau', kind: 'buy' },
  { text: 'buy a pressure washer', kind: 'buy' },
  { text: 'acheter un nettoyeur', kind: 'buy' },
  { text: 'purchase a hammer', kind: 'buy' },
  { text: 'do you sell drills', kind: 'buy' },
  { text: 'price of a hammer', kind: 'buy' },
  { text: 'prix de la perceuse', kind: 'buy' },
  { text: 'commander une échelle', kind: 'buy' },
  { text: 'je veux acheter une perceuse', kind: 'buy' },
  { text: 'I want a pizza tonight', kind: 'food' },
  { text: "J'ai faim, un repas", kind: 'food' },
  { text: 'I am hungry', kind: 'food' },
  { text: 'je veux manger', kind: 'food' },
  { text: 'restaurant nearby', kind: 'food' },
  { text: 'pizza please', kind: 'food' },
  { text: 'un plat ce soir', kind: 'food' },
  { text: 'What is the deposit?', kind: 'question' },
  { text: 'Quelle est la caution ?', kind: 'question' },
  { text: 'Where do I pick up the hammer?', kind: 'question' },
  { text: 'Is the battery included?', kind: 'question' },
  { text: 'what is the condition', kind: 'question' },
  { text: 'how much is the return', kind: 'question' },
  { text: 'combien est la caution', kind: 'question' },
  { text: 'rent a compactor from 3rd to 4th', kind: 'rent' },
  { text: 'louer une scie mardi', kind: 'rent' },
  { text: 'where do I return it', kind: 'question' },
  { text: 'I am hungry for a meal', kind: 'food' },
  { text: 'buy a ladder please', kind: 'buy' },
];

describe('assistant rental eval set', () => {
  it('classifies the prompt set without inventing availability', () => {
    for (const prompt of PROMPTS) {
      expect(classifyRentalWords(prompt.text)).toBe(prompt.kind);
    }
    expect(PROMPTS.length).toBe(60);
    const invented = sanitizeRentalModelText('The hammer is available for 2 500 FCFA.', {
      rentalCards: false,
      rentalGrounded: false,
      rentalIntent: true,
    });
    expect(invented.toLowerCase()).not.toMatch(/available|fcfa/);
  });

  it('keeps a November range and treats a far month-day as past', () => {
    expect(validateExclusiveRange('2026-11-17', '2026-11-18', TODAY).status).toBe('ok');
    expect(resolveMonthDay(11, 3, TODAY).past).toBe(true);
    expect(
      shouldAskBuyOrRent({ text: 'I need a drill', rentMatches: 1, buyMatches: 1, shoppingEnabled: false })
    ).toBe(false);
  });
});
