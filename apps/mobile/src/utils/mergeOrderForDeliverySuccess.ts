import type { Order } from '../types/agent';

/** Prefer nested `client` (clients.id) for ratings when the API returns a partial order after complete. */
export function mergeOrderForDeliverySuccess(snap: Order, api: Order | null | undefined): Order {
  if (!api) return snap;
  const client = api.client ?? snap.client;
  const client_id = client?.id ?? api.client_id ?? snap.client_id;
  return { ...snap, ...api, client, client_id };
}
