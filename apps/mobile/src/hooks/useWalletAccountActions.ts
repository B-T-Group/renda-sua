import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AccountInfoRow, InitiateMobilePaymentResponse } from '../types/accountWallet';

async function openPaymentUrlIfPresent(url: string): Promise<boolean> {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!(await Linking.canOpenURL(trimmed))) return false;
  await Linking.openURL(trimmed);
  return true;
}

export interface WalletAccountActionsDeps {
  isStripeRail: boolean;
  withdrawFromAccount: (
    account: AccountInfoRow,
    amount: number,
    phoneE164?: string,
    pin?: string
  ) => Promise<{ success: boolean; message?: string }>;
  stripeWithdrawFromAccount: (
    account: AccountInfoRow,
    amount: number
  ) => Promise<{ success: boolean; message?: string }>;
  topUpAccount: (
    account: AccountInfoRow,
    phoneE164: string,
    amount: number
  ) => Promise<InitiateMobilePaymentResponse>;
  refetch: () => Promise<void>;
}

export function useWalletAccountActions(deps: WalletAccountActionsDeps) {
  const { t } = useTranslation();
  const {
    isStripeRail,
    withdrawFromAccount,
    stripeWithdrawFromAccount,
    topUpAccount,
    refetch,
  } = deps;

  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const handleWithdrawConfirm = useCallback(
    async (
      account: AccountInfoRow,
      amount: number,
      phoneE164?: string,
      pin?: string
    ) => {
      setWithdrawSubmitting(true);
      try {
        const res = isStripeRail
          ? await stripeWithdrawFromAccount(account, amount)
          : await withdrawFromAccount(account, amount, phoneE164, pin);
        if (res.success) {
          await refetch();
          setSnack(
            t(
              'accounts.withdrawSuccess',
              'Withdrawal started. Your balance will update when it completes.'
            )
          );
          return { success: true as const };
        }
        return { success: false as const, message: res.message };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : undefined;
        return { success: false as const, message };
      } finally {
        setWithdrawSubmitting(false);
      }
    },
    [isStripeRail, stripeWithdrawFromAccount, withdrawFromAccount, refetch, t]
  );

  const handleTopUpConfirm = useCallback(
    async (account: AccountInfoRow, phoneE164: string, amount: number) => {
      setTopUpSubmitting(true);
      try {
        const res = await topUpAccount(account, phoneE164, amount);
        if (!res.success) return { success: false as const, message: res.message };
        const url = res.data?.paymentUrl;
        const opened = url ? await openPaymentUrlIfPresent(url) : false;
        const msg = opened
          ? t(
              'accounts.topUpBrowserOpened',
              'Complete payment in your browser. Your balance will update when it succeeds.'
            )
          : (res.data?.message ?? t('accounts.topUpStarted', 'Top-up started.'));
        setSnack(msg);
        await refetch();
        return { success: true as const };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : undefined;
        return { success: false as const, message };
      } finally {
        setTopUpSubmitting(false);
      }
    },
    [topUpAccount, refetch, t]
  );

  return {
    withdrawSubmitting,
    topUpSubmitting,
    snack,
    setSnack,
    handleWithdrawConfirm,
    handleTopUpConfirm,
  };
}
