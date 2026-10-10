import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { PayBoard, PayBoardStatus } from '../types/agentPayBoard';

function withoutItems(board: PayBoard | null): PayBoard | null {
  return board ? { ...board, items: [] } : null;
}

export function useAgentPayBoard(status: PayBoardStatus) {
  const [board, setBoard] = useState<PayBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedStatus = useRef<PayBoardStatus | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const switching = loadedStatus.current !== status;
    try {
      setBoard(await agentApi.agents.getPayBoard(status));
      loadedStatus.current = status;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load pay';
      setError(message);
      if (switching) setBoard(withoutItems);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { board, loading, error, refetch };
}
