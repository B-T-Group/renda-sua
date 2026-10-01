import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import {
  MOMO_POLL_INTERVAL_MS,
  claimPollTerminalPhase,
  claimTransactionErrorCodeFromBody,
  claimTransactionStatusFromBody,
  resolveClaimPaymentPhase,
  type ClaimPaymentPollPhase,
} from '../utils/momoPaymentPoll';

export type ClaimPaymentPollState =
  | { phase: 'waiting' }
  | { phase: 'paid' }
  | { phase: 'failed' }
  | { phase: 'taken' }
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

  const checkOnce = useCallback(async (): Promise<ClaimPaymentPollPhase> => {
    const id = idRef.current;
    if (!id || !apiClient) return 'waiting';
    const response = await apiClient.get(`/mobile-payments/transactions/${id}`);
    const body = response.data;
    return resolveClaimPaymentPhase(
      claimTransactionStatusFromBody(body),
      claimTransactionErrorCodeFromBody(body)
    );
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
  checkOnce: () => Promise<ClaimPaymentPollPhase>;
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
    checkOnce: () => Promise<ClaimPaymentPollPhase>;
    isStopped: () => boolean;
    onPhase: (phase: ClaimPaymentPollState) => void;
  },
  startedAt: number,
  getInterval: () => ReturnType<typeof setInterval> | null
): Promise<void> {
  const phase = await args.checkOnce();
  if (args.isStopped()) return;
  const terminal = claimPollTerminalPhase(phase, Date.now() - startedAt);
  if (!terminal) return;
  args.onPhase({ phase: terminal });
  const intervalId = getInterval();
  if (intervalId) clearInterval(intervalId);
}
