import { classifyRentalWords, shouldAskBuyOrRent } from './assistant-rental-intent';

describe('rental intent', () => {
  it('asks buy or rent only when both sides match an ambiguous object', () => {
    expect(classifyRentalWords('I need a drill')).toBe('ambiguous');
    expect(classifyRentalWords("J'ai besoin d'une perceuse")).toBe('ambiguous');
    expect(
      shouldAskBuyOrRent({ text: 'I need a drill', rentMatches: 2, buyMatches: 1, shoppingEnabled: true })
    ).toBe(true);
    expect(
      shouldAskBuyOrRent({ text: 'I need a drill', rentMatches: 2, buyMatches: 0, shoppingEnabled: true })
    ).toBe(false);
    expect(
      shouldAskBuyOrRent({ text: 'I want to rent a drill', rentMatches: 2, buyMatches: 3, shoppingEnabled: true })
    ).toBe(false);
  });

  it('treats a date range as rent and food words as food', () => {
    expect(classifyRentalWords('a drill from Friday to Sunday')).toBe('rent');
    expect(classifyRentalWords('I want a pizza tonight')).toBe('food');
    expect(classifyRentalWords('What is the deposit?')).toBe('question');
  });
});
