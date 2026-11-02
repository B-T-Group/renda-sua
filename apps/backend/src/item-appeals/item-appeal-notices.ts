import { normalizeLanguage } from '../notifications/email-template-data';

/** EN/FR copy for appeal notices (in-app body + push), per recipient language. */
export function appealReceivedCopy(lang: string | null | undefined, itemName: string, slaHours: number) {
  if (normalizeLanguage(lang) === 'fr') {
    return {
      title: 'Recours reçu',
      body: `Nous avons reçu votre recours pour « ${itemName} ». Décision sous ${slaHours} h.`,
    };
  }
  return {
    title: 'Appeal received',
    body: `We received your appeal for "${itemName}". Expect a decision within ${slaHours} h.`,
  };
}

export function appealDecidedCopy(
  lang: string | null | undefined,
  itemName: string,
  outcome: 'upheld' | 'approved' | 'pending'
) {
  const fr = normalizeLanguage(lang) === 'fr';
  const outcomeText = fr
    ? { upheld: 'la décision est maintenue', approved: 'votre article est approuvé', pending: 'votre article est renvoyé en vérification' }[outcome]
    : { upheld: 'the decision stands', approved: 'your item is approved', pending: 'your item is back in review' }[outcome];
  return {
    title: fr ? 'Recours examiné' : 'Appeal reviewed',
    body: fr
      ? `Votre recours pour « ${itemName} » : ${outcomeText}.`
      : `Your appeal for "${itemName}": ${outcomeText}.`,
    outcomeText,
  };
}
