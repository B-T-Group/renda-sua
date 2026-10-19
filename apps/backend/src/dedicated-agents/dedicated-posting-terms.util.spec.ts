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

  describe('QA #613 N1 hardening (each QA probe)', () => {
    it.each([
      ['Call chezmama.tg', 'Call'],
      ['Site chezmama . tg merci', 'Site merci'],
      ['Voir chezmama.bj', 'Voir'],
      ['Voir chez-mama.ci/menu ou mama.sn', 'Voir ou'],
      ['chezmama dot com', ''],
      ['chezmama point cm', ''],
      ['chezmama (dot) com', ''],
    ])('bare domains: %s', (raw, out) => {
      expect(sanitizePostingTerms(raw) ?? '').toBe(out);
    });

    it.each([
      ['Mail name at gmail dot com svp', 'Mail svp'],
      ['Mail name (at) gmail (dot) com', 'Mail'],
      ['Mail name [at] gmail [dot] com', 'Mail'],
      ['Mail name @ gmail . com', 'Mail'],
      ['Mail mama arobase yahoo point fr', 'Mail'],
    ])('spelled e-mails: %s', (raw, out) => {
      expect(sanitizePostingTerms(raw) ?? '').toBe(out);
    });

    it.each([
      ['Appelez 90 12 34', 'Appelez'],
      ['Appelez 901234', 'Appelez'],
      ['Tel 22 12 34 5', 'Tel'],
    ])('6+ digit runs: %s', (raw, out) => {
      expect(sanitizePostingTerms(raw)).toBe(out);
    });

    it.each([
      ['Appelez zero six sept huit un deux trois', 'Appelez'],
      ['Appelez zéro six, sept huit, un deux', 'Appelez'],
      ['Call nine zero one two three four', 'Call'],
      ['Appelez 0 six 7 huit 1 deux', 'Appelez'],
    ])('spelled-out digits: %s', (raw, out) => {
      expect(sanitizePostingTerms(raw)).toBe(out);
    });

    it('Arabic-Indic (and Eastern Arabic) digits are read as digits', () => {
      expect(sanitizePostingTerms('Appelez ٠٦ ١٢ ٣٤ ٥٦ ٧٨')).toBe('Appelez');
      expect(sanitizePostingTerms('Appelez ۰۶۱۲۳۴۵۶')).toBe('Appelez');
      expect(sanitizePostingTerms('Prime ٢ ٠٠٠ FCFA')).toBe('Prime 2 000 FCFA');
    });

    it('tel:, whatsapp: and mailto: links go entirely', () => {
      expect(sanitizePostingTerms('Joindre tel:+22890123456 ou ici')).toBe('Joindre ou ici');
      expect(sanitizePostingTerms('Joindre tel:+228')).toBe('Joindre');
      expect(sanitizePostingTerms('whatsapp:22890123456 / mailto:x@y.tg')).toBe('/');
    });

    it.each([
      'Un casque neuf, une tenue et deux gilets',
      'Prime de 2 000 FCFA par jour, 10 000 - 20 000 - 30 000 FCFA selon la saison',
      'Du lundi au samedi, 8h-12h. Me contacter via RendaSua.',
      'Livraisons: 5 à 10 par jour. Co-équipier bienvenu',
      'Horaires 7h30 - 11h30, pause 12h00-12h30',
    ])('keeps ordinary terms: %s', (raw) => {
      expect(sanitizePostingTerms(raw)).toBe(raw);
    });
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
