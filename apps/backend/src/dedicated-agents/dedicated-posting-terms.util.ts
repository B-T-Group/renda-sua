/** #594 AC-B11 posting Terms / notes: plain text, at most 1,000 characters. */
export const POSTING_TERMS_MAX = 1000;

const TAGS = /<\/?[a-z][^>]*>/gi;
/** Country and common TLDs a contact could hide behind (West/Central Africa first). */
const TLDS =
  'com|net|org|info|biz|io|co|me|app|shop|store|online|site|xyz|link|ly|africa|' +
  'cm|ga|cg|cd|ci|sn|tg|bj|ml|bf|ne|td|gn|gq|cf|ng|gh|ke|za|ma|dz|tn|fr|be|ch|ca|us|uk';
// A dot written as ".", " . ", " dot " or " point " (QA #613 N1: "chezmama . tg", "x dot com").
const DOT = String.raw`(?:\.|\s+\.\s+|\s*[([{]\s*(?:dot|point)\s*[)\]}]\s*|\s+(?:dot|point)\s+)`;
// Scheme or www. links, and bare host names ending in a known TLD ("wa.me/…", "chezmama.bj").
const URLS = new RegExp(
  String.raw`\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:${DOT}[a-z0-9-]+)*${DOT}(?:${TLDS})\b(?:\/\S*)?`,
  'gi'
);
const EMAILS = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
// "name at gmail dot com", "name (at) gmail (dot) com", "name @ gmail . com", "arobase".
const SPELLED_EMAILS = new RegExp(
  String.raw`\b[\w.+-]+\s*(?:@|[([{]\s*(?:at|arobase)\s*[)\]}]|\s(?:at|arobase)\s)\s*[\w-]+(?:${DOT}[\w-]+)*${DOT}(?:${TLDS})\b`,
  'gi'
);
// tel:, sms:, whatsapp:, mailto: links and whatever follows them.
const CONTACT_SCHEMES = /\b(?:tel|sms|whatsapp|mailto|callto|viber|skype):\S+/gi;
// Phone-shaped runs: 6+ digits (QA #613 N1, local numbers can be 6–8), optionally +,
// separated by spaces, dots, dashes or brackets. "8h–12h", "de 7h30 à 11h" and amounts
// followed by a currency ("10 000-20 000 FCFA") keep their numbers.
const PHONE_CANDIDATES = /(?:\(\+?|\+\(?)?\d[\d\s().-]{4,}\d/g;
const PHONE_MIN_DIGITS = 6;
const CURRENCY_AFTER = /^\s*(?:fcfa|cfa|xaf|xof|f\b|€|eur\b|\$|usd\b|cad\b)/i;
// Spelled-out digits (fr + en). Six or more in a row read as a number being dictated.
const NUMBER_WORDS =
  'z[eé]ro|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|' +
  'vingts?|trente|quarante|cinquante|soixante|septante|huitante|octante|nonante|cents?|mille|' +
  'oh|one|two|three|four|five|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|' +
  'seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|double|triple';
const NUMBER_TOKEN = String.raw`(?:${NUMBER_WORDS}|\d+)`;
const SPELLED_NUMBERS = new RegExp(
  String.raw`\b${NUMBER_TOKEN}(?:(?:[\s,.;/-]|\bet\b|\band\b)+${NUMBER_TOKEN}){5,}\b`,
  'gi'
);
/** Zero code points of the decimal digit blocks NFKC leaves alone (Arabic-Indic, Devanagari, …). */
const DIGIT_ZEROS = [
  0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6,
  0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0,
  0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0,
];

/** Every Unicode decimal digit becomes its ASCII digit (QA #613 N1: "٠٦ ١٢ ٣٤ ٥٦ ٧٨"). */
export function normaliseDigits(text: string): string {
  return text.normalize('NFKC').replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0x30 && cp <= 0x39) return ch;
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    return zero == null ? ch : String(cp - zero);
  });
}

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
    if (run.replace(/\D/g, '').length < PHONE_MIN_DIGITS) return run;
    if (CURRENCY_AFTER.test(text.slice(offset + run.length))) return run;
    return ' ';
  });
}

/**
 * Server-side clean-up of posting terms (best effort, QA #613 N1): HTML tags,
 * contact links (tel:, whatsapp:, …), links and bare domains (also "x . tg",
 * "x dot com"), e-mail addresses (also "name at gmail dot com"), phone-shaped
 * runs of 6+ digits in any script, and 6+ spelled-out digits are removed
 * (contact goes through RendaSua; the phone is shown only once the business
 * accepts). Returns null for empty terms.
 */
export function sanitizePostingTerms(raw: unknown): string | null {
  if (raw == null) return null;
  let text = stripControl(normaliseDigits(String(raw)).replace(/\r\n?/g, '\n'));
  text = text
    .replace(TAGS, ' ')
    .replace(CONTACT_SCHEMES, ' ')
    .replace(EMAILS, ' ')
    .replace(SPELLED_EMAILS, ' ')
    .replace(URLS, ' ')
    // Digit-only runs are left to stripPhones (which keeps amounts before a currency).
    .replace(SPELLED_NUMBERS, (run: string) => (/[a-zé]/i.test(run) ? ' ' : run));
  text = stripPhones(text);
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}
