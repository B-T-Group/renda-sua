import { rentalSearchTerms } from './assistant-rental-query';

const VEHICLES = [{ name: 'Vehicles' }, { name: 'Equipment' }];

describe('rental search terms', () => {
  it('searches Tesla before the word car, and never the whole sentence', () => {
    const terms = rentalSearchTerms(
      'car',
      'I want a Tesla car in Libreville from 17 Nov to 18 Nov',
      VEHICLES
    );
    expect(terms[0]).toBe('tesla');
    expect(terms).toContain('Vehicles');
    expect(terms.join(' ')).not.toMatch(/libreville|want to rent/i);
  });

  it('maps a car sentence onto the Vehicles category instead of the sentence', () => {
    const sentence = 'I want to rent a car in Libreville from 17 Nov to 18 Nov';
    const terms = rentalSearchTerms(sentence, sentence, VEHICLES);
    expect(terms).toEqual(['Vehicles']);
  });

  it('leaves an equipment query alone', () => {
    expect(rentalSearchTerms('equipment', 'rent equipment tomorrow', VEHICLES)).toEqual(['equipment']);
  });
});
