/**
 * French elides "que" before a vowel: "En attente qu’Amina démarre", "qu’Éric", "qu’Yves".
 * Names starting with a consonant (h included) keep "que".
 */
export function elidesBefore(word: string | null | undefined): boolean {
  return /^[aeiouyàâäéèêëîïôöùûüÿæœ]/i.test(String(word ?? '').trim());
}

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** "Waiting for Amina to start" / "En attente qu’Amina démarre" / "En attente que Paul démarre". */
export function waitingForRenterTitle(name: string, language: string, t: Translate): string {
  const french = language.toLowerCase().startsWith('fr');
  if (french && elidesBefore(name)) {
    return t('rentals.business.waitingTitleElided', 'Waiting for {{name}} to start', { name });
  }
  return t('rentals.business.waitingTitle', 'Waiting for {{name}} to start', { name });
}
