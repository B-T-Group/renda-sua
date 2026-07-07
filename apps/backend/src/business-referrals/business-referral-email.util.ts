import type { PaymentRail } from '../stripe-payments/payment-routing.service';

export function buildActivationStepsHtml(
  rail: PaymentRail,
  locale: 'en' | 'fr'
): string {
  if (rail === 'stripe') {
    return locale === 'fr'
      ? `<ul>
<li>Aider le commerçant à signer le contrat de partenariat marchand dans l'application</li>
<li>L'aider à compléter l'onboarding bancaire Stripe Connect pour activer les paiements</li>
<li>L'aider à créer ses premiers produits et à les publier en ligne</li>
</ul>`
      : `<ul>
<li>Help them sign the merchant partnership agreement in the app</li>
<li>Help them complete Stripe Connect banking onboarding to activate payments</li>
<li>Help them create their first products and publish them online</li>
</ul>`;
  }

  return locale === 'fr'
    ? `<ul>
<li>Aider le commerçant à signer le contrat de partenariat marchand dans l'application</li>
<li>L'aider à téléverser une pièce d'identité officielle (carte d'identité, passeport ou permis de conduire)</li>
<li>L'aider à créer ses premiers produits et à les publier en ligne</li>
</ul>`
    : `<ul>
<li>Help them sign the merchant partnership agreement in the app</li>
<li>Help them upload a government-issued ID (ID card, passport, or driver license)</li>
<li>Help them create their first products and publish them online</li>
</ul>`;
}
