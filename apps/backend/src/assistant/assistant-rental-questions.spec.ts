import { rentalAnswerGrounded, rentalQuestionTopic } from './assistant-rental-questions';

describe('rental question grounding', () => {
  it('maps deposit and pickup questions', () => {
    expect(rentalQuestionTopic('What is the deposit?')).toBe('deposit');
    expect(rentalQuestionTopic('Où est le retrait ?')).toBe('pickup');
    expect(rentalQuestionTopic('Is the battery included?')).toBe('included');
  });

  it('treats a blank pickup note as ungrounded', () => {
    const listing = { pickup_instructions: '   ', security_deposit_amount: 10000, rental_item: { description: '' } };
    expect(rentalAnswerGrounded(listing, 'pickup')).toBe(false);
    expect(rentalAnswerGrounded(listing, 'deposit')).toBe(true);
    expect(rentalAnswerGrounded(listing, 'included')).toBe(false);
  });
});
