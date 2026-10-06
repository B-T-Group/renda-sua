import { useEffect, useRef, useState } from 'react';
import type { LastAssistantReply } from '../../contexts/AssistantChatContext';
import type { RendaState } from './rendaCharacterEngine';

/** Thinking stays up at least this long so fast replies never flicker (spec §1). */
export const THINKING_MIN_MS = 400;
/** Responding is a 900 ms one-shot. */
export const RESPONDING_MS = 900;
/** Success sparkle total ≤ 1.2 s. */
export const SUCCESS_MS = 1200;

export type { LastAssistantReply };

export interface RendaChatInputs {
  isSending: boolean;
  lastReply: LastAssistantReply;
  /** The empty-state hero is on screen (no messages yet). */
  isEmpty: boolean;
  composerFocused: boolean;
  composerHasText: boolean;
}

type Phase = 'rest' | 'thinking' | 'responding' | 'success';

/**
 * Drives the /assistant character from real chat events (spec §1 state table):
 * Idle → Attentive (composer focused) → Listening (focused and non-empty, empty
 * state only) → Thinking (request in flight, ≥ 400 ms) → Responding (reply
 * renders, 900 ms) → Success (only when the reply carried a successful tool
 * result; max once per reply, never on error or handoff) → Idle. An error or an
 * empty reply goes straight back to Idle after the minimum Thinking time.
 */
export function useRendaChatState({
  isSending,
  lastReply,
  isEmpty,
  composerFocused,
  composerHasText,
}: RendaChatInputs): RendaState {
  const [phase, setPhase] = useState<Phase>('rest');
  const thinkingSinceRef = useRef(0);
  const seqAtSendRef = useRef(lastReply.seq);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wasSendingRef = useRef(isSending);
  const lastReplyRef = useRef(lastReply);
  lastReplyRef.current = lastReply;

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    const was = wasSendingRef.current;
    wasSendingRef.current = isSending;
    if (isSending && !was) {
      clearTimers();
      thinkingSinceRef.current = Date.now();
      seqAtSendRef.current = lastReplyRef.current.seq;
      setPhase('thinking');
      return;
    }
    if (!isSending && was) {
      clearTimers();
      const reply = lastReplyRef.current;
      const gotReply = reply.seq !== seqAtSendRef.current;
      const wait = Math.max(
        0,
        THINKING_MIN_MS - (Date.now() - thinkingSinceRef.current)
      );
      const showSuccess = gotReply && reply.toolSuccess && !reply.handoff;
      after(wait, () => {
        if (!gotReply) {
          setPhase('rest');
          return;
        }
        setPhase('responding');
        after(RESPONDING_MS, () => {
          if (!showSuccess) {
            setPhase('rest');
            return;
          }
          setPhase('success');
          after(SUCCESS_MS, () => setPhase('rest'));
        });
      });
    }
  }, [isSending]);

  useEffect(() => () => clearTimers(), []);

  if (phase !== 'rest') return phase;
  if (isEmpty && composerFocused)
    return composerHasText ? 'listening' : 'attentive';
  return 'idle';
}
