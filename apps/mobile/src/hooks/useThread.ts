import { useCallback, useEffect, useRef, useState } from 'react';
import { threadsApi } from '../services/threadsApi';
import type { ThreadDetail, ThreadMessage } from '../types/threads';

export function useThread(threadId: string) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await threadsApi.getThread(threadId);
      if (mountedRef.current) {
        setThread(data);
        void threadsApi.markThreadRead(threadId).catch(() => undefined);
      }
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message ?? 'Failed to load thread');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { void load(); }, [load]);

  const reply = useCallback(async (body: string): Promise<ThreadMessage | null> => {
    setSending(true);
    try {
      const msg = await threadsApi.replyToThread(threadId, body);
      if (mountedRef.current) {
        setThread((prev) =>
          prev ? { ...prev, messages: [...(prev.messages ?? []), msg] } : prev
        );
      }
      return msg;
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message ?? 'Failed to send reply');
      return null;
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [threadId]);

  return { thread, loading, sending, error, reload: load, reply };
}
