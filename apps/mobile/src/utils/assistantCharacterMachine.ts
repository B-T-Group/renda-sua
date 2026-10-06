/**
 * Chat-screen state machine for the Renda character (#451 spec §1 state table).
 * Pure and clock-injected: callers pass `now` and schedule a wake-up at
 * `nextWakeAt`. Used by AssistantCharacterStore (hero + header avatar).
 *
 * Priority: Success > Responding > Thinking > Listening > Attentive > Idle.
 */

export type ChatCharacterState =
  | 'idle'
  | 'attentive'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'success';

export const CHAT_CHARACTER_TIMING = {
  /** Thinking never flickers: shown at least this long. */
  thinkingMin: 400,
  /** Non-streaming reply: one 900 ms Responding one-shot. */
  responding: 900,
  /** Success one-shot (pop + sparkles) ≤ 1.2 s. */
  success: 1200,
} as const;

export type ReplyOutcome = 'reply' | 'error' | 'handoff';

export type ChatCharacterMachine = {
  composerFocused: boolean;
  composerNonEmpty: boolean;
  /** When the current Thinking began (null = not thinking). */
  thinkingSince: number | null;
  /** Request in flight. */
  sending: boolean;
  /** Settled reply waiting for the 400 ms minimum Thinking time. */
  pending: { outcome: ReplyOutcome; toolSuccess: boolean } | null;
  respondingUntil: number | null;
  /** Success queued to play when Responding ends (max once per reply). */
  successQueued: boolean;
  successUntil: number | null;
};

export const initialChatCharacterMachine: ChatCharacterMachine = {
  composerFocused: false,
  composerNonEmpty: false,
  thinkingSince: null,
  sending: false,
  pending: null,
  respondingUntil: null,
  successQueued: false,
  successUntil: null,
};

export type ChatCharacterEvent =
  | { type: 'composer'; focused: boolean; nonEmpty: boolean }
  | { type: 'send' }
  | { type: 'settled'; outcome: ReplyOutcome; toolSuccess?: boolean }
  | { type: 'reset' }
  | { type: 'tick' };

function applyOutcome(
  m: ChatCharacterMachine,
  outcome: ReplyOutcome,
  toolSuccess: boolean,
  now: number
): ChatCharacterMachine {
  const base = { ...m, thinkingSince: null, pending: null };
  // Error → Idle (no sad face; the error banner explains).
  if (outcome === 'error') return { ...base, respondingUntil: null, successQueued: false };
  return {
    ...base,
    respondingUntil: now + CHAT_CHARACTER_TIMING.responding,
    // Success only for a successful tool result, never on handoff.
    successQueued: outcome === 'reply' && toolSuccess,
    successUntil: null,
  };
}

/** Advance timers that are due at `now`. */
function advance(m: ChatCharacterMachine, now: number): ChatCharacterMachine {
  let next = m;
  if (next.pending && next.thinkingSince !== null) {
    if (now - next.thinkingSince >= CHAT_CHARACTER_TIMING.thinkingMin) {
      // Timers run from the moment the outcome became visible.
      const due = next.thinkingSince + CHAT_CHARACTER_TIMING.thinkingMin;
      next = applyOutcome(next, next.pending.outcome, next.pending.toolSuccess, due);
    }
  }
  if (next.respondingUntil !== null && now >= next.respondingUntil) {
    const endedAt = next.respondingUntil;
    next = {
      ...next,
      respondingUntil: null,
      successQueued: false,
      successUntil: next.successQueued ? endedAt + CHAT_CHARACTER_TIMING.success : null,
    };
  }
  if (next.successUntil !== null && now >= next.successUntil) {
    next = { ...next, successUntil: null };
  }
  return next;
}

export function reduceChatCharacter(
  m: ChatCharacterMachine,
  event: ChatCharacterEvent,
  now: number
): ChatCharacterMachine {
  const current = advance(m, now);
  switch (event.type) {
    case 'composer':
      return { ...current, composerFocused: event.focused, composerNonEmpty: event.nonEmpty };
    case 'send':
      return {
        ...current,
        sending: true,
        thinkingSince: now,
        pending: null,
        respondingUntil: null,
        successQueued: false,
        successUntil: null,
      };
    case 'settled': {
      if (!current.sending && current.thinkingSince === null) return current;
      const toolSuccess = event.toolSuccess === true;
      const settled = { ...current, sending: false };
      const since = settled.thinkingSince ?? now;
      if (now - since < CHAT_CHARACTER_TIMING.thinkingMin) {
        return { ...settled, pending: { outcome: event.outcome, toolSuccess } };
      }
      return applyOutcome(settled, event.outcome, toolSuccess, now);
    }
    case 'reset':
      return {
        ...initialChatCharacterMachine,
        composerFocused: current.composerFocused,
        composerNonEmpty: current.composerNonEmpty,
      };
    case 'tick':
    default:
      return current;
  }
}

export function chatCharacterState(m: ChatCharacterMachine, now: number): ChatCharacterState {
  const c = advance(m, now);
  if (c.successUntil !== null) return 'success';
  if (c.respondingUntil !== null) return 'responding';
  if (c.thinkingSince !== null) return 'thinking';
  if (c.composerFocused && c.composerNonEmpty) return 'listening';
  if (c.composerFocused) return 'attentive';
  return 'idle';
}

/** Earliest future time at which the state can change on its own (null = none). */
export function chatCharacterNextWakeAt(m: ChatCharacterMachine, now: number): number | null {
  const c = advance(m, now);
  const candidates: number[] = [];
  if (c.pending && c.thinkingSince !== null) {
    candidates.push(c.thinkingSince + CHAT_CHARACTER_TIMING.thinkingMin);
  }
  if (c.respondingUntil !== null) candidates.push(c.respondingUntil);
  if (c.successUntil !== null) candidates.push(c.successUntil);
  const future = candidates.filter((t) => t > now);
  return future.length ? Math.min(...future) : null;
}

/** Header avatar: idle is static and attentive/listening read as idle there. */
export function headerCharacterState(state: ChatCharacterState): ChatCharacterState {
  return state === 'attentive' || state === 'listening' ? 'idle' : state;
}
