import { saveItemWithAppealConfirm } from './itemRejectionRecovery';

export async function patchItemWithAppealConfirm<T>(
  updateItem: (id: string, data: T) => Promise<unknown>,
  itemId: string,
  data: T,
  confirmWithdraw: () => boolean | Promise<boolean>
) {
  return saveItemWithAppealConfirm(
    (confirmWithdrawAppeal) =>
      updateItem(
        itemId,
        confirmWithdrawAppeal
          ? { ...data, confirmWithdrawAppeal: true }
          : data
      ),
    confirmWithdraw
  );
}
