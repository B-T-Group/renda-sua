const SIGNATURE_BLOCK_RE =
  /\{\{#signatureImageUrl\}\}[\s\S]*?\{\{\/signatureImageUrl\}\}/g;

export type MerchantAgreementVars = {
  businessName: string;
  signerLegalName: string;
  signerEmail: string;
  acceptedAt: string;
  agreementVersion: string;
};

/** Fills Mustache placeholders when the API returns a raw template (e.g. older backend). */
export function renderMerchantAgreementHtml(
  template: string,
  vars: MerchantAgreementVars
): string {
  if (!template.includes('{{')) {
    return template;
  }
  let html = template.replace(SIGNATURE_BLOCK_RE, '');
  const keys: (keyof MerchantAgreementVars)[] = [
    'businessName',
    'signerLegalName',
    'signerEmail',
    'acceptedAt',
    'agreementVersion',
  ];
  for (const key of keys) {
    html = html.split(`{{${key}}}`).join(vars[key] ?? '');
  }
  return html;
}

export function merchantAgreementPreviewVars(
  profile: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    business?: { name?: string | null } | null;
  },
  version: string,
  locale: string
): MerchantAgreementVars {
  const fr = locale.startsWith('fr');
  return {
    businessName: profile.business?.name ?? '',
    signerLegalName: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
    signerEmail: profile.email ?? '',
    acceptedAt: fr ? 'À la signature électronique' : 'Upon electronic acceptance',
    agreementVersion: version,
  };
}
