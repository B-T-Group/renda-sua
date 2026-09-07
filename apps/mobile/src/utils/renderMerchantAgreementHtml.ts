const SIGNATURE_BLOCK_RE =
  /\{\{#signatureImageUrl\}\}[\s\S]*?\{\{\/signatureImageUrl\}\}/g;

export type MerchantAgreementVars = {
  businessName: string;
  signerLegalName: string;
  signerEmail: string;
  acceptedAt: string;
  agreementVersion: string;
};

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
  me: {
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
    businessName: me.business?.name ?? '',
    signerLegalName: `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim(),
    signerEmail: me.email ?? '',
    acceptedAt: fr ? 'À la signature électronique' : 'Upon electronic acceptance',
    agreementVersion: version,
  };
}
