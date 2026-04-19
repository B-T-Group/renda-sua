import { environment } from '../config/environment';

/**
 * URL for social / crawler previews: server-rendered HTML when using the API host,
 * or the web app path `/items/:id/seo` when `REACT_APP_WEB_APP_ORIGIN` is set and
 * your CDN forwards that path to the backend HTML endpoint.
 */
export function buildInventoryItemSeoShareUrl(inventoryId: string): string {
  const web = environment.webAppOrigin?.replace(/\/$/, '');
  if (web) {
    return `${web}/items/${inventoryId}/seo`;
  }
  const apiRoot = environment.apiUrl.replace(/\/$/, '');
  return `${apiRoot}/inventory-items/${inventoryId}/seo`;
}
