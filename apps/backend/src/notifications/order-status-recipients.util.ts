export type OrderStatusRecipient = {
  email?: string | null;
  type: string;
  userId?: string;
};

/**
 * Drops recipients whose user id matches the acting user (e.g. agent who picked up the order).
 */
export function excludeActorFromOrderStatusRecipients(
  recipients: OrderStatusRecipient[],
  actorUserId?: string | null
): OrderStatusRecipient[] {
  if (actorUserId == null || String(actorUserId).trim() === '') {
    return recipients;
  }
  const id = String(actorUserId).trim();
  return recipients.filter((r) => !r.userId || r.userId !== id);
}
