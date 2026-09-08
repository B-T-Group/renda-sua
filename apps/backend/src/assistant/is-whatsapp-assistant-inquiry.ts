/**
 * Cheap pre-filter: skip Bedrock for inbound WhatsApp text that is clearly
 * not a Rendasua customer inquiry (auto-replies, acknowledgements, etc.).
 * Conservative — interrogatives always pass; ambiguous text reaches the model.
 */
export function isWhatsAppAssistantInquiry(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  // Questions always reach the model (e.g. "where is my order?").
  if (/\?/.test(normalized)) return true;
  // Auto-replies / away messages — check before keyword heuristics so
  // "we received your order" is not treated as an order inquiry.
  if (looksAutomated(normalized)) return false;
  if (isAcknowledgementOnly(normalized)) return false;
  return true;
}

function isAcknowledgementOnly(text: string): boolean {
  const stripped = text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return true;
  return ACK_ONLY.test(stripped);
}

function looksAutomated(text: string): boolean {
  return AUTOMATED_PATTERNS.some((pattern) => pattern.test(text));
}

const ACK_ONLY =
  /^(ok|okay|k|thanks|thank\s*you|thx|merci|d['']accord|bien|parfait|noted|not[eé]|received|re[cç]u|got\s*it|cool|super|yes|oui|no|non)$/i;

const AUTOMATED_PATTERNS: RegExp[] = [
  /\bautomated\s+message\b/i,
  /\bmessage\s+automatique\b/i,
  /\bauto[- ]?reply\b/i,
  /\br[eé]ponse\s+automatique\b/i,
  /\bthanks?\s+for\s+(contacting|reaching\s+out|your\s+(message|order))\b/i,
  /\bmerci\s+(de\s+nous\s+avoir\s+contact[eé]|pour\s+(votre\s+)?(message|commande))\b/i,
  /\bwe\s+(have\s+)?received\s+your\s+order\b/i,
  /\bcommande\b[\s\S]{0,40}\bre[cç]ue?\b/i,
  /\bwe['’]?ll\s+get\s+back\s+to\s+you\b/i,
  /\bnous\s+(reviendrons|vous\s+recontacterons)\b/i,
  /\bour\s+team\s+will\s+(get\s+back|respond|contact)\b/i,
  /\byou\s+have\s+reached\b/i,
  /\bvous\s+avez\s+(joint|atteint)\b/i,
  /\bwe\s+are\s+(currently\s+)?(away|unavailable|closed)\b/i,
  /\bnous\s+(sommes\s+)?(actuellement\s+)?(absents?|indisponibles?|ferm[eé]s?)\b/i,
  /\bbusiness\s+hours\b/i,
  /\bheures?\s+d['']ouverture\b/i,
  /\bthis\s+is\s+an?\s+(automatic|automated)\b/i,
  /\bceci\s+est\s+un\s+message\s+automatique\b/i,
];
