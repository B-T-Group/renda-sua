import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/agentApi';
import {
  MOMO_POLL_INTERVAL_MS,
  MOMO_POLL_TIMEOUT_MS,
  resolveMomoPaymentStatuses,
  type MomoPaymentPollPhase,
} from '../utils/momoPaymentPoll';

export type MobileMoneyPollState =
  | { phase: 'waiting' }
  | { phase: 'paid' }
  | { phase: 'failed' }
  | { phase: 'timeout' };

export function useMobileMoneyPaymentPoll(orderIds: string[]) {
  const [state, setState] = useState<MobileMoneyPollState>({ phase: 'waiting' });
  const [error, setError] = useState<string | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const stoppedRef = useRef(false);
  const idsKey = orderIds.join(',');
  const orderIdsRef = useRef(orderIds);
  orderIdsRef.current = orderIds;

  const stop = useCallback(() => {
    stoppedRef.current = true;
  }, []);

  const restart = useCallback(() => {
    stoppedRef.current = false;
    setError(null);
    setState({ phase: 'waiting' });
    setRestartToken((n) => n + 1);
  }, []);

  const checkOnce = useCallback(async (): Promise<MomoPaymentPollPhase> => {
    const ids = orderIdsRef.current;
    const statuses = await Promise.all(
      ids.map(async (id) => {
        const order = await agentApi.orders.getById(id);
        return order.payment_status;
      })
    );
    return resolveMomoPaymentStatuses(statuses);
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    setState({ phase: 'waiting' });
    setError(null);
    if (!orderIds.length) return;

    const startedAt = Date.now();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (stoppedRef.current) return;
      try {
        const phase = await checkOnce();
        if (stoppedRef.current) return;
        if (phase === 'paid' || phase === 'failed') {
          setState({ phase });
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (Date.now() - startedAt >= MOMO_POLL_TIMEOUT_MS) {
          setState({ phase: 'timeout' });
          if (intervalId) clearInterval(intervalId);
        }
      } catch (e: unknown) {
        if (stoppedRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to check payment');
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), MOMO_POLL_INTERVAL_MS);

    return () => {
      stoppedRef.current = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [idsKey, restartToken, checkOnce, orderIds.length]);

  return { state, error, stop, restart };
}
