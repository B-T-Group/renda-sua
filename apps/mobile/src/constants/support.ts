/** Primary support inbox for merchant/agent appeal emails. */
export const SUPPORT_EMAIL = 'info@rendasua.com';

export function supportMailto(subject: string, body?: string): string {
  const query = new URLSearchParams({ subject });
  if (body?.trim()) query.set('body', body.trim());
  return `mailto:${SUPPORT_EMAIL}?${query.toString()}`;
}
