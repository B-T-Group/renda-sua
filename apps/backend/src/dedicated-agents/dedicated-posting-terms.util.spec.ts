import { POSTING_TERMS_MAX, sanitizePostingTerms } from './dedicated-posting-terms.util';

describe('sanitizePostingTerms (AC-B11)', () => {
  it('returns null for empty or blank terms', () => {
    expect(sanitizePostingTerms(undefined)).toBeNull();
    expect(sanitizePostingTerms(null)).toBeNull();
    expect(sanitizePostingTerms('   \n  ')).toBeNull();
  });

  it.each([
    ['Appelez le 6 77 12 34 56 pour les détails', 'Appelez le pour les détails'],
    ['WhatsApp +237 677 123 456 svp', 'WhatsApp svp'],
    ['Tel: (+237) 677-12-34-56.', 'Tel: .'],
    ['Gabon 07 12 34 56', 'Gabon'],
    ['Numéro 699887766', 'Numéro'],
  ])('strips phone numbers: %s', (raw, out) => {
    expect(sanitizePostingTerms(raw)).toBe(out);
  });

  it.each([
    'Horaires 8h–12h, tenue correcte',
    'De 7h30 à 11h, du lundi au samedi',
    'Prime de 2 000 FCFA par jour',
    'Bonus 1 000-2 000 FCFA selon la saison',
    'Commandes: 10 à 15 par créneau',
    'Pause 12h00-12h30',
  ])('keeps non-phone numbers: %s', (raw) => {
    expect(sanitizePostingTerms(raw)).toBe(raw);
  });

  it('strips links, bare domains and e-mail addresses', () => {
    expect(sanitizePostingTerms('Voir https://chezmama.cm/jobs?x=1 ou www.example.com')).toBe('Voir ou');
    expect(sanitizePostingTerms('Écrivez sur wa.me/237677123456 ou chezmama.cm')).toBe('Écrivez sur ou');
    expect(sanitizePostingTerms('Mail: recrutement@chezmama.cm merci')).toBe('Mail: merci');
  });

  it('removes HTML tags and control characters, keeps line breaks (max one blank line)', () => {
    expect(sanitizePostingTerms('<b>Tenue</b> noire\u0007\r\n\r\n\r\n\r\n<script>x</script>Casque obligatoire')).toBe(
      'Tenue noire\n\nx Casque obligatoire'
    );
  });

  it('does not truncate: the caller enforces the limit on the cleaned text', () => {
    const long = 'a'.repeat(POSTING_TERMS_MAX + 5);
    expect(sanitizePostingTerms(long)).toHaveLength(POSTING_TERMS_MAX + 5);
  });
});
