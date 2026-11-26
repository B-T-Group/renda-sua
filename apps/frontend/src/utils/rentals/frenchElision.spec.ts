import { elidesBefore, waitingForRenterTitle } from './frenchElision';

const fr = (key: string, _f: string, vars: Record<string, string> = {}) =>
  key.endsWith('Elided') ? `En attente qu’${vars.name} démarre` : `En attente que ${vars.name} démarre`;
const en = (_k: string, fallback: string, vars: Record<string, string> = {}) =>
  fallback.replace(/{{(\w+)}}/g, (_m, n: string) => vars[n] ?? '');

describe('French elision before renter names', () => {
  it('elides before vowels, accented vowels and y', () => {
    for (const name of ['Amina', 'Éric', 'emma', 'Olivier', 'Ursule', 'Yves', 'Îsa', ' Ali']) expect(elidesBefore(name)).toBe(true);
    for (const name of ['Paul', 'Hugo', 'Moussa', '', null]) expect(elidesBefore(name)).toBe(false);
  });

  it('builds the waiting title', () => {
    expect(waitingForRenterTitle('Amina', 'fr', fr)).toBe('En attente qu’Amina démarre');
    expect(waitingForRenterTitle('Paul', 'fr', fr)).toBe('En attente que Paul démarre');
    expect(waitingForRenterTitle('Amina', 'en', en)).toBe('Waiting for Amina to start');
  });
});
