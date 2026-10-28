function webOrigin(apiUrl: string): string {
  return apiUrl.includes('localhost') || apiUrl.includes('dev.api')
    ? 'https://dev.rendasua.com'
    : 'https://rendasua.com';
}

/** Public web URL for a store page (location or business id), matching the API environment. */
export function storeWebUrl(storeId: string, apiUrl: string): string {
  return `${webOrigin(apiUrl)}/store/${storeId}`;
}

/** Public web URL for a catalog item page, matching the API environment. */
export function itemWebUrl(inventoryItemId: string, apiUrl: string): string {
  return `${webOrigin(apiUrl)}/items/${inventoryItemId}/seo`;
}
