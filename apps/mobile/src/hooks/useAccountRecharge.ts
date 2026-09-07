import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfileMe } from './useProfileMe';
import { usePermission } from './usePermissions';
import { PlatformPermissions } from '../constants/platformPermissions';
import {
  fetchRecentRecharges,
  getRechargeTransactionStatus,
  initiateAccountRecharge,
  type AccountTopUpRecord,
  type InitiateRechargeParams,
  type RechargeTransaction,
} from '../services/accountRechargeApi';

const POLL_INTERVAL_MS = 5000;

export function useAccountRecharge() {
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(PlatformPermissions.RECHARGE_ACCOUNT, me);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<AccountTopUpRecord[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [polledTx, setPolledTx] = useState<RechargeTransaction | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const loadRecent = useCallback(async () => {
    if (!canAccess) return;
    setTransactionsLoading(true);
    try {
      const items = await fetchRecentRecharges();
      setRecentTransactions(items);
    } catch {
      // best-effort
    } finally {
      setTransactionsLoading(false);
    }
  }, [canAccess]);

  const startPolling = useCallback(
    (txId: string) => {
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const tx = await getRechargeTransactionStatus(txId);
          setPolledTx(tx);
          if (tx.status !== 'pending') {
            stopPolling();
            void loadRecent();
          }
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [loadRecent, stopPolling]
  );

  const initiateRecharge = useCallback(
    async (params: InitiateRechargeParams) => {
      setLoading(true);
      setError(null);
      setPolledTx(null);
      try {
        const result = await initiateAccountRecharge(params);
        startPolling(result.transactionId);
        return result;
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to initiate recharge';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [startPolling]
  );

  useEffect(() => {
    if (!profileLoading && canAccess) void loadRecent();
  }, [canAccess, loadRecent, profileLoading]);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  return {
    canAccess,
    loading,
    error,
    polling,
    polledTx,
    recentTransactions,
    transactionsLoading,
    initiateRecharge,
    loadRecent,
  };
}
