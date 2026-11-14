import { rentalAnswerGrounded, rentalQuestionSay, rentalQuestionTopic } from './assistant-rental-questions';

describe('rental question grounding', () => {
  it('maps deposit and pickup questions', () => {
    expect(rentalQuestionTopic('What is the deposit?')).toBe('deposit');
    expect(rentalQuestionTopic('Où est le retrait ?')).toBe('pickup');
    expect(rentalQuestionTopic('Is the battery included?')).toBe('included');
  });

  it('treats a blank pickup note as ungrounded when the area is empty too', () => {
    const listing = { pickup_instructions: '   ', security_deposit_amount: 10000, rental_item: { description: '' } };
    expect(rentalAnswerGrounded(listing, 'pickup')).toBe(false);
    expect(rentalAnswerGrounded(listing, 'deposit')).toBe(true);
    expect(rentalAnswerGrounded(listing, 'included')).toBe(false);
    expect(rentalQuestionSay(listing, 'included', 'en')).toMatch(/doesn't say/);
    expect(rentalQuestionSay(listing, 'deposit', 'en')).toBeNull();
  });

  it('answers pickup from the listing area when the note is blank', () => {
    const listing = {
      pickup_instructions: '',
      business_location: { address: { city: 'Akwa', state: 'Douala' } },
      rental_item: { description: '' },
    };
    expect(rentalAnswerGrounded(listing, 'pickup')).toBe(true);
    expect(rentalQuestionSay(listing, 'pickup', 'en')).toBe(
      'Pickup is in Akwa, Douala. The exact address is shared once the business accepts.',
    );
    expect(rentalQuestionSay(listing, 'pickup', 'fr')).toContain('Akwa, Douala');
    expect(rentalQuestionSay(listing, 'pickup', 'fr')).toContain('adresse exacte');
  });
});
