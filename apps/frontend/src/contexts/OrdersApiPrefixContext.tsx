import React, { createContext, useContext } from 'react';

/**
 * When set to `/delegate`, order hooks rewrite `/orders…` → `/delegate/orders…`.
 * Empty string keeps owner paths unchanged.
 */
const OrdersApiPrefixContext = createContext('');

export const OrdersApiPrefixProvider = OrdersApiPrefixContext.Provider;

export function useOrdersApiPrefix(): string {
  return useContext(OrdersApiPrefixContext);
}

/** Join API prefix with an `/orders…` path. */
export function withOrdersApiPrefix(prefix: string, path: string): string {
  if (!prefix) return path;
  if (path.startsWith('/orders')) {
    return `${prefix}${path}`;
  }
  return path;
}
