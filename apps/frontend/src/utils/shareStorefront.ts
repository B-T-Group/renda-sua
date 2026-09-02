/**
 * Share a storefront URL via Web Share API or clipboard fallback.
 */
export async function shareStorefront(params: {
  businessId: string;
  name: string;
  shareMessage: string;
}): Promise<'shared' | 'copied'> {
  const url = `${window.location.origin}/store/${params.businessId}`;
  const text = params.shareMessage.includes(url)
    ? params.shareMessage
    : `${params.shareMessage} ${url}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title: params.name, text, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

export function buildStoreShareMessage(
  name: string,
  businessId: string,
  template: string
): string {
  const url = `${window.location.origin}/store/${businessId}`;
  return template
    .replace(/\{\{\s*name\s*\}\}/g, name)
    .replace(/\{\{\s*url\s*\}\}/g, url);
}
