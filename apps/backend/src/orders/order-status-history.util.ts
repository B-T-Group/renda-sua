import { isUuid } from '../common/uuid.util';

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

export function statusHistoryVariables(input: StatusHistoryInput) {
  return {
    orderId: input.orderId,
    status: input.status,
    notes: input.notes ?? null,
    changedByType: input.changedByType,
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
