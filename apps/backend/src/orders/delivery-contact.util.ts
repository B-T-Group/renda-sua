/** Who an agent or merchant should actually contact about a delivery. */
export interface DeliveryContact {
  name: string;
  phone: string | null;
  /** True when this is a third-party recipient rather than the paying client. */
  is_recipient: boolean;
}

interface OrderContactShape {
  recipient_name?: string | null;
  recipient_phone?: string | null;
  is_third_party_recipient?: boolean | null;
  client?: {
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      phone_number?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

function payerDisplayName(order: OrderContactShape): string {
  const user = order.client?.user;
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
}

/**
 * The delivery contact is the recipient when someone else is receiving the
 * order, otherwise the paying client. Agents dial this number, so a diaspora
 * order must never resolve to the payer's foreign phone.
 */
export function resolveDeliveryContact(order: OrderContactShape): DeliveryContact {
  const recipientName = order.recipient_name?.trim();
  const recipientPhone = order.recipient_phone?.trim();
  if (order.is_third_party_recipient && recipientName && recipientPhone) {
    return { name: recipientName, phone: recipientPhone, is_recipient: true };
  }
  return {
    name: payerDisplayName(order),
    phone: order.client?.user?.phone_number?.trim() || null,
    is_recipient: false,
  };
}

/** Attaches `delivery_contact` without changing anything else on the order. */
export function withDeliveryContact<T extends OrderContactShape>(
  order: T
): T & { delivery_contact: DeliveryContact } {
  return { ...order, delivery_contact: resolveDeliveryContact(order) };
}

/**
 * Attaches `delivery_contact` and, for third-party orders, removes the payer's
 * phone and email so an agent cannot call or email someone abroad by mistake.
 * The payer's name stays visible as the person who ordered.
 */
export function withDeliveryContactForFulfiller<T extends OrderContactShape>(
  order: T
): T & { delivery_contact: DeliveryContact } {
  const delivery_contact = resolveDeliveryContact(order);
  if (!delivery_contact.is_recipient) {
    return { ...order, delivery_contact };
  }
  return {
    ...order,
    delivery_contact,
    client: order.client
      ? {
          ...order.client,
          user: order.client.user
            ? { ...order.client.user, phone_number: null, email: null }
            : order.client.user,
        }
      : order.client,
  };
}
