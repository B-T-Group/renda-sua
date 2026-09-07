import { useCallback, useEffect, useMemo, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { AccountInfoRow, AccountTransactionRow } from '../types/accountWallet';
import { isLegacyWallet } from '../utils/walletAccounts';
import { useStripeConnect } from './useStripeConnect';

const XAF = 'XAF';

export { isLegacyWallet } from '../utils/walletAccounts';

/**
 * Pick the personal wallet account for the active rail. Mobile-money users use
 * the legacy XAF wallet; Stripe-rail users use their non-XAF (e.g. CAD/USD)
 * legacy wallet.
 */
function pickWalletAccount(
  accounts: AccountInfoRow[],
  isStripeRail: boolean,
  preferredCurrency?: string | null
): AccountInfoRow | null {
  const legacy = accounts.filter(isLegacyWallet);
  if (preferredCurrency?.trim()) {
    const preferred = preferredCurrency.trim().toUpperCase();
    const match = legacy.find((a) => a.currency === preferred);
    if (match) return match;
  }
  if (isStripeRail) {
    return legacy.find((a) => a.currency !== XAF) ?? legacy[0] ?? null;
  }
  return legacy.find((a) => a.currency === XAF) ?? legacy[0] ?? null;
}

function sortTransactionsDesc(rows: AccountTransactionRow[]): AccountTransactionRow[] {
  return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function sortByLocationName(a: AccountInfoRow, b: AccountInfoRow): number {
  const nameA = a.business_location?.name?.toLowerCase() ?? '';
  const nameB = b.business_location?.name?.toLowerCase() ?? '';
  return nameA.localeCompare(nameB);
}

export function useAgentXafWallet(
  enabled: boolean,
  preferredCurrency?: string | null
) {
  const [accounts, setAccounts] = useState<AccountInfoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    status: connectStatus,
    fetchStatus: refetchStripe,
    openDashboard: openStripeDashboard,
    startOnboarding: startStripeOnboarding,
    actionLoading: stripeActionLoading,
  } = useStripeConnect();

  const isStripeRail = connectStatus?.paymentRail === 'stripe';
  const stripeConnected = !!connectStatus?.connected;
  const stripeReady =
    stripeConnected &&
    (connectStatus?.status === 'active' ||
      (!!connectStatus?.chargesEnabled && !!connectStatus?.payoutsEnabled));

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.accounts.getInfo();
      if (!res.success || !res.data?.accounts) {
        throw new Error(res.error || 'Failed to load account');
      }
      setAccounts(res.data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account load error');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);

  useEffect(() => {
    if (enabled && preferredCurrency) {
      void refetch();
    }
  }, [enabled, preferredCurrency, refetch]);

  const account = useMemo(
    () => pickWalletAccount(accounts, !!isStripeRail, preferredCurrency),
    [accounts, isStripeRail, preferredCurrency]
  );

  const personalAccounts = useMemo(() => {
    const legacy = accounts.filter(isLegacyWallet);
    if (!account) return legacy;
    return [account, ...legacy.filter((a) => a.id !== account.id)];
  }, [accounts, account]);

  const locationAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.business_location_id != null)
        .slice()
        .sort(sortByLocationName),
    [accounts]
  );

  const transactions = useMemo(
    () => (account ? sortTransactionsDesc(account.account_transactions ?? []) : []),
    [account]
  );

  const availableBalance = account?.available_balance ?? 0;
  const currency = account?.currency ?? preferredCurrency ?? null;

  const withdrawFromAccount = useCallback(
    async (
      target: AccountInfoRow,
      amount: number,
      phoneE164?: string,
      pin?: string
    ) => {
      return agentApi.mobilePayments.initiate({
        amount,
        currency: target.currency,
        description: 'Withdrawal',
        customerPhone: phoneE164,
        accountId: target.id,
        transactionType: 'GIVE_CHANGE',
        withdrawalPin: pin,
      });
    },
    []
  );

  const stripeWithdrawFromAccount = useCallback(
    async (target: AccountInfoRow, amount: number) => {
      const res = await agentApi.stripe.withdraw({
        amount,
        currency: target.currency,
        accountId: target.id,
        description: 'Withdrawal',
      });
      return { success: res.success, message: res.message };
    },
    []
  );

  const topUpAccount = useCallback(
    async (target: AccountInfoRow, customerPhone: string, amount: number) => {
      return agentApi.mobilePayments.initiate({
        amount,
        currency: target.currency,
        description: 'Wallet top-up',
        customerPhone,
        accountId: target.id,
        transactionType: 'PAYMENT',
      });
    },
    []
  );

  const initiateWithdraw = useCallback(
    async (customerPhone: string, amount: number) => {
      if (!account) {
        return { success: false as const, message: 'No wallet' };
      }
      return withdrawFromAccount(account, amount, customerPhone);
    },
    [account, withdrawFromAccount]
  );

  const initiateStripeWithdraw = useCallback(
    async (amount: number) => {
      if (!account) {
        return { success: false as const, message: 'No wallet' };
      }
      return stripeWithdrawFromAccount(account, amount);
    },
    [account, stripeWithdrawFromAccount]
  );

  const initiateTopUp = useCallback(
    async (customerPhone: string, amount: number) => {
      if (!account) {
        return { success: false as const, message: 'No wallet' };
      }
      return topUpAccount(account, customerPhone, amount);
    },
    [account, topUpAccount]
  );

  return {
    wallet: account,
    allAccounts: accounts,
    personalAccounts,
    locationAccounts,
    transactions,
    availableBalance,
    currency,
    loading,
    error,
    refetch,
    refetchStripe,
    initiateWithdraw,
    initiateStripeWithdraw,
    initiateTopUp,
    withdrawFromAccount,
    stripeWithdrawFromAccount,
    topUpAccount,
    isStripeRail: !!isStripeRail,
    stripeConnected,
    stripeReady,
    stripeActionLoading,
    openStripeDashboard,
    startStripeOnboarding,
  };
}
