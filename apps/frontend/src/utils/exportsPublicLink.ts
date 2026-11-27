import { environment } from '../config/environment';

/** Canonical (indexed) URL of the public origin page. Always the production host. */
export const EXPORTS_CANONICAL_ORIGIN = 'https://rendasua.com';

export function exportsOriginPath(code: string): string {
  return `/exports/${code.toLowerCase()}`;
}

export function exportsCanonicalUrl(code: string): string {
  return `${EXPORTS_CANONICAL_ORIGIN}${exportsOriginPath(code)}`;
}

/** Link copied by "Copy link": https://rendasua.com/exports/{cc} in production. */
export function exportsShareUrl(code: string): string {
  const web = (environment.webAppOrigin || EXPORTS_CANONICAL_ORIGIN).replace(/\/$/, '');
  return `${web}${exportsOriginPath(code)}`;
}
