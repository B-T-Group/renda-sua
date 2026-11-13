import {
  assertModelCannotCreateRentalRequests,
  listedToolNames,
  sanitizeRentalModelText,
} from './assistant-rental-guard';

describe('rental model guardrail', () => {
  it('refuses a tool that can create a rental request', () => {
    expect(() => assertModelCannotCreateRentalRequests(['search_rentals', 'quote_rental'])).not.toThrow();
    expect(() => assertModelCannotCreateRentalRequests(['create_rental_request'])).toThrow(/not model tools/);
    const names = listedToolNames([
      { toolSpec: { name: 'search_rentals' } },
      { toolSpec: { name: 'get_rental_listing_details' } },
    ]);
    expect(names).not.toContain('create_rental_request');
  });

  it('removes prices from text when rental cards are shown and keeps at most two sentences', () => {
    const text =
      'I found a hammer for 2 500 FCFA from 17 Nov to 18 Nov. It is a good one. A third sentence.';
    const cleaned = sanitizeRentalModelText(text, {
      rentalCards: true,
      rentalGrounded: true,
      rentalIntent: true,
    });
    expect(cleaned).not.toMatch(/FCFA/);
    expect(cleaned).toContain('17 Nov');
    expect(cleaned.split(/[.!?]/).filter((part) => part.trim()).length).toBeLessThanOrEqual(2);
  });

  it('removes an availability claim that no rental tool grounded', () => {
    const cleaned = sanitizeRentalModelText('The hammer is available for 2 500 FCFA.', {
      rentalCards: false,
      rentalGrounded: false,
      rentalIntent: true,
    });
    expect(cleaned.toLowerCase()).not.toMatch(/available/);
    expect(cleaned).not.toMatch(/FCFA/);
  });
});
