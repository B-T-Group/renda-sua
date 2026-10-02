/** Public web URL for a store page (location or business id), matching the API environment. */
export function storeWebUrl(storeId: string, apiUrl: string): string {
  const origin =
    apiUrl.includes('localhost') || apiUrl.includes('dev.api')
      ? 'https://dev.rendasua.com'
      : 'https://rendasua.com';
  return `${origin}/store/${storeId}`;
}
