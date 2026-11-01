import { isUuid } from '../common/uuid.util';

/** Matches order_status_history_changed_by_type_check. */
export const ORDER_STATUS_HISTORY_CHANGED_BY_TYPES = [
  'client',
  'business',
  'agent',
  'system',
] as const;

export type OrderStatusHistoryChangedByType =
  (typeof ORDER_STATUS_HISTORY_CHANGED_BY_TYPES)[number];

const CHANGED_BY_TYPE_ALIASES: Record<string, OrderStatusHistoryChangedByType> =
  {
    user: 'client',
    admin: 'system',
    delegate: 'business',
  };

export const CREATE_STATUS_HISTORY_MUTATION = `
  mutation CreateStatusHistory(
    $orderId: uuid!
    $status: order_status!
    $notes: String
    $changedByType: String!
    $changedByUserId: uuid
  ) {
    insert_order_status_history(objects: [{
      order_id: $orderId
      status: $status
      notes: $notes
      changed_by_type: $changedByType
      changed_by_user_id: $changedByUserId
    }]) { affected_rows }
  }
`;

export type StatusHistoryInput = {
  orderId: string;
  status: string;
  notes?: string | null;
  changedByType: string;
  changedByUserId?: string | null;
};

export function statusHistoryUserId(value?: string | null): string | null {
  return isUuid(value) ? value.trim() : null;
}

export function normalizeChangedByType(
  value?: string | null
): OrderStatusHistoryChangedByType {
  const raw = (value ?? '').trim().toLowerCase();
  if (
    (ORDER_STATUS_HISTORY_CHANGED_BY_TYPES as readonly string[]).includes(raw)
  ) {
    return raw as OrderStatusHistoryChangedByType;
  }
  return CHANGED_BY_TYPE_ALIASES[raw] ?? 'system';
}

export function statusHistoryVariables(input: StatusHistoryInput) {
  return {
    orderId: input.orderId,
    status: input.status,
    notes: input.notes ?? null,
    changedByType: normalizeChangedByType(input.changedByType),
    changedByUserId: statusHistoryUserId(input.changedByUserId),
  };
}

export async function insertOrderStatusHistory(
  hasura: {
    executeMutation: (
      mutation: string,
      variables: Record<string, unknown>
    ) => Promise<unknown>;
  },
  input: StatusHistoryInput
): Promise<void> {
  await hasura.executeMutation(
    CREATE_STATUS_HISTORY_MUTATION,
    statusHistoryVariables(input)
  );
}
