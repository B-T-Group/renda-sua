import {
  alignRentalCountClaim,
  assertModelCannotCreateRentalRequests,
  claimedRentalCount,
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

  it('rewrites only a total rental count that disagrees with the cards', () => {
    const cm =
      'Here are the equipment rentals available in Yaounde from 17 Nov to 18 Nov: Please note that the last two options are for testing purposes and should not be booked.';
    const found = 'I found 3 rentals. Pickup is in Yaounde from 17 Nov to 18 Nov.';
    const article = 'Voici une location au centre de Libreville.';
    const subset = 'Les deux options suivantes sont pour des tests.';
    expect(claimedRentalCount(cm)).toBeNull();
    expect(alignRentalCountClaim(cm, 5, 'en')).toBe(cm);
    expect(claimedRentalCount(article)).toBeNull();
    expect(alignRentalCountClaim(article, 2, 'fr')).toBe(article);
    expect(claimedRentalCount(subset)).toBeNull();
    expect(alignRentalCountClaim(subset, 5, 'fr')).toBe(subset);
    expect(alignRentalCountClaim('There are three options. See the categories.', 0, 'en')).toBe(
      'No rentals are available for those dates.'
    );
    expect(alignRentalCountClaim(found, 2, 'en')).toBe(
      'There are 2 rentals. Pickup is in Yaounde from 17 Nov to 18 Nov.'
    );
    expect(claimedRentalCount('There are three options.')).toBe(3);
    expect(claimedRentalCount('None were available.')).toBe(0);
    expect(claimedRentalCount('Il y a trois options.')).toBe(3);
    expect(alignRentalCountClaim('There are three options.', 2, 'en')).toBe('There are 2 rentals.');
    expect(alignRentalCountClaim('None were available.', 2, 'en')).toBe('There are 2 rentals.');
    expect(alignRentalCountClaim('Il y a trois options.', 0, 'fr')).toBe(
      'Aucune location n’est disponible pour ces dates.'
    );
    expect(alignRentalCountClaim('There are 2 rentals.', 2, 'en')).toBe('There are 2 rentals.');
    expect(alignRentalCountClaim('I can help with the dates.', 2, 'en')).toBe('I can help with the dates.');
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
