import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import {
  MOMO_POLL_INTERVAL_MS,
  MOMO_POLL_TIMEOUT_MS,
  resolveClaimPaymentPhase,
  type MomoPaymentPollPhase,
} from '../utils/momoPaymentPoll';

export type ClaimPaymentPollState =
  | { phase: 'waiting' }
  | { phase: 'paid' }
  | { phase: 'failed' }
  | { phase: 'timeout' };

export function useClaimPaymentPoll(transactionId: string | null) {
  const apiClient = useApiClient();
  const [state, setState] = useState<ClaimPaymentPollState>({ phase: 'waiting' });
  const [error, setError] = useState<string | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const stoppedRef = useRef(false);
  const idRef = useRef(transactionId);
  idRef.current = transactionId;

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
    const id = idRef.current;
    if (!id || !apiClient) return 'waiting';
    const response = await apiClient.get(`/mobile-payments/transactions/${id}`);
    const status = response.data?.data?.status ?? response.data?.status;
    return resolveClaimPaymentPhase(status);
  }, [apiClient]);

  useEffect(() => {
    stoppedRef.current = false;
    setState({ phase: 'waiting' });
    setError(null);
    if (!transactionId) return undefined;
    const stopPoll = pollClaimPayment({
      checkOnce,
      isStopped: () => stoppedRef.current,
      onPhase: setState,
      onError: (message) => setError(message),
    });
    return () => {
      stoppedRef.current = true;
      stopPoll();
    };
  }, [transactionId, restartToken, checkOnce]);

  return { state, error, stop, restart };
}

function pollClaimPayment(args: {
  checkOnce: () => Promise<MomoPaymentPollPhase>;
  isStopped: () => boolean;
  onPhase: (phase: ClaimPaymentPollState) => void;
  onError: (message: string) => void;
}): () => void {
  const startedAt = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const tick = async () => {
    if (args.isStopped()) return;
    try {
      await applyClaimPollTick(args, startedAt, () => intervalId);
    } catch (e: unknown) {
      if (args.isStopped()) return;
      const message = e instanceof Error ? e.message : 'Failed to check payment';
      args.onError(message);
    }
  };
  void tick();
  intervalId = setInterval(() => void tick(), MOMO_POLL_INTERVAL_MS);
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}

async function applyClaimPollTick(
  args: {
    checkOnce: () => Promise<MomoPaymentPollPhase>;
    isStopped: () => boolean;
    onPhase: (phase: ClaimPaymentPollState) => void;
  },
  startedAt: number,
  getInterval: () => ReturnType<typeof setInterval> | null
): Promise<void> {
  const phase = await args.checkOnce();
  if (args.isStopped()) return;
  if (phase === 'paid' || phase === 'failed') {
    args.onPhase({ phase });
    const intervalId = getInterval();
    if (intervalId) clearInterval(intervalId);
    return;
  }
  if (Date.now() - startedAt >= MOMO_POLL_TIMEOUT_MS) {
    args.onPhase({ phase: 'timeout' });
    const intervalId = getInterval();
    if (intervalId) clearInterval(intervalId);
  }
}
