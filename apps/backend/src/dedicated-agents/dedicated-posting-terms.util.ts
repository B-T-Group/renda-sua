/** #594 AC-B11 posting Terms / notes: plain text, at most 1,000 characters. */
export const POSTING_TERMS_MAX = 1000;

const TAGS = /<\/?[a-z][^>]*>/gi;
// Scheme or www. links, and bare host names with a common TLD ("wa.me/…", "chezmama.cm").
const URLS = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|biz|io|co|me|app|cm|ga|cg|cd|ci|sn|fr|ca|africa|link|ly)\b(?:\/\S*)?/gi;
const EMAILS = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
// Phone-shaped runs only: 8+ digits, optionally +, separated by spaces, dots, dashes or brackets.
// "8h–12h", "de 7h30 à 11h" and amounts followed by a currency ("1 000-2 000 FCFA") keep their numbers.
const PHONE_CANDIDATES = /(?:\(\+?|\+\(?)?\d[\d\s().-]{6,}\d/g;
const CURRENCY_AFTER = /^\s*(?:fcfa|cfa|xaf|f\b|€|eur\b|\$|usd\b|cad\b)/i;
/** Control characters other than tab and line feed (CR is normalised before). */
function stripControl(text: string): string {
  return [...text]
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c === 9 || c === 10 || (c >= 32 && c !== 127);
    })
    .join('');
}

function stripPhones(text: string): string {
  return text.replace(PHONE_CANDIDATES, (run: string, offset: number) => {
    if (run.replace(/\D/g, '').length < 8) return run;
    if (CURRENCY_AFTER.test(text.slice(offset + run.length))) return run;
    return ' ';
  });
}

/**
 * Server-side clean-up of posting terms: HTML tags, links, e-mail addresses and
 * phone numbers are removed (contact goes through RendaSua; the phone is shown
 * only once the business accepts). Returns null for empty terms.
 */
export function sanitizePostingTerms(raw: unknown): string | null {
  if (raw == null) return null;
  let text = stripControl(String(raw).replace(/\r\n?/g, '\n'));
  text = text.replace(TAGS, ' ').replace(EMAILS, ' ').replace(URLS, ' ');
  text = stripPhones(text);
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}
