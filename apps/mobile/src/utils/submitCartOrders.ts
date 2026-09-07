import type { CartLine } from '../types/cart';
import type { CreatedOrder, CreateOrderPayload } from '../types/clientOrder';
import { agentApi } from '../services/agentApi';
import { toOrderItemVariantId } from './shopperVariantSelection';

export async function submitOrdersForCartGroups(
  groups: CartLine[][],
  common: Omit<CreateOrderPayload, 'items'>
): Promise<
  { ok: true; orderNumbers: string[]; orders: CreatedOrder[] } | { ok: false; message: string }
> {
  const orderNumbers: string[] = [];
  const orders: CreatedOrder[] = [];
  for (const lines of groups) {
    const items: CreateOrderPayload['items'] = lines.map((l) => {
      const orderVariantId = toOrderItemVariantId(l.variantId);
      return {
        business_inventory_id: l.inventoryItemId,
        quantity: l.quantity,
        ...(orderVariantId ? { item_variant_id: orderVariantId } : {}),
      };
    });
    const body: CreateOrderPayload = { ...common, items };
    const res = await agentApi.orders.createOrder(body);
    if (!res.success) {
      const msg =
        (typeof res.message === 'string' && res.message.trim()) ||
        (typeof res.data?.error === 'string' && res.data.error.trim()) ||
        (typeof res.error === 'string' && res.error.trim()) ||
        'Order failed';
      return { ok: false, message: msg };
    }
    const num = res.order?.order_number ?? res.order?.id ?? '';
    if (num) orderNumbers.push(num);
    if (res.order) orders.push(res.order);
  }
  return { ok: true, orderNumbers, orders };
}
