/**
 * Detects user turns that must be answered from get_knowledge (markets/payments),
 * not from the model's general world knowledge.
 */
export function needsKnowledgeGrounding(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (COUNTRY_OR_MARKET.test(normalized)) return true;
  if (PAYMENT_RAIL.test(normalized) && PLACE_HINT.test(normalized)) return true;
  return false;
}

const COUNTRY_OR_MARKET =
  /\b(brazil|br[eé]sil|canada|gabon|cameroon|cameroun|congo|togo|c[oô]te\s*d['’]?ivoire|ivory\s*coast|nigeria|france|senegal|s[eé]n[eé]gal|usa|u\.s\.a\.|united\s*states|états?-unis|etats?-unis|country|countries|pays|market|markets|march[eé]s?|disponible\s+(au|en|à|aux)|available\s+in|operate\s+in|serve\s+in|ship\s+to|livr(ez|er)\s+(au|en|à)|où\s+(êtes|etes)-vous|where\s+(are|do)\s+you)\b/i;

const PAYMENT_RAIL =
  /\b(pix|stripe|mobile\s*money|momo|airtel|moov|mtn|orange\s*money|card|carte|paiement|payment)\b/i;

const PLACE_HINT =
  /\b(in|au|en|à|aux|brazil|br[eé]sil|canada|gabon|cameroon|cameroun|country|pays)\b/i;
