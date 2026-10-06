import { act, renderHook } from '@testing-library/react';
import type { LastAssistantReply } from '../../contexts/AssistantChatContext';
import {
  RESPONDING_MS,
  RendaChatInputs,
  SUCCESS_MS,
  THINKING_MIN_MS,
  useRendaChatState,
} from './useRendaChatState';

const NONE: LastAssistantReply = { seq: 0, toolSuccess: false, handoff: false };
const base: RendaChatInputs = {
  isSending: false,
  lastReply: NONE,
  isEmpty: true,
  composerFocused: false,
  composerHasText: false,
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup(initial: Partial<RendaChatInputs> = {}) {
  return renderHook((p: RendaChatInputs) => useRendaChatState(p), {
    initialProps: { ...base, ...initial },
  });
}
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('useRendaChatState', () => {
  it('Idle → Attentive (composer focused) → Typing/Listening (non-empty) → Idle (blur)', () => {
    const { result, rerender } = setup();
    expect(result.current).toBe('idle');
    rerender({ ...base, composerFocused: true });
    expect(result.current).toBe('attentive');
    rerender({ ...base, composerFocused: true, composerHasText: true });
    expect(result.current).toBe('listening');
    rerender({ ...base, composerFocused: false, composerHasText: true });
    expect(result.current).toBe('idle');
  });

  it('Listening is for the empty state only', () => {
    const { result } = setup({ isEmpty: false, composerFocused: true, composerHasText: true });
    expect(result.current).toBe('idle');
  });

  it('Thinking holds for at least 400 ms, then Responding for 900 ms, then Idle (plain answer)', () => {
    const { result, rerender } = setup({ composerFocused: true, composerHasText: true });
    rerender({ ...base, isSending: true, isEmpty: false });
    expect(result.current).toBe('thinking');
    advance(100);
    // A fast reply lands at 100 ms.
    rerender({ ...base, isSending: false, isEmpty: false, lastReply: { seq: 1, toolSuccess: false, handoff: false } });
    expect(result.current).toBe('thinking');
    advance(THINKING_MIN_MS - 100 - 1);
    expect(result.current).toBe('thinking');
    advance(1);
    expect(result.current).toBe('responding');
    advance(RESPONDING_MS);
    expect(result.current).toBe('idle');
  });

  it('a slow reply goes straight to Responding', () => {
    const { result, rerender } = setup();
    rerender({ ...base, isSending: true, isEmpty: false });
    advance(1500);
    rerender({ ...base, isEmpty: false, lastReply: { seq: 1, toolSuccess: false, handoff: false } });
    advance(0);
    expect(result.current).toBe('responding');
  });

  it('Success only after a reply with a successful tool result, once, then Idle', () => {
    const { result, rerender } = setup();
    rerender({ ...base, isSending: true, isEmpty: false });
    advance(500);
    const reply = { seq: 1, toolSuccess: true, handoff: false };
    rerender({ ...base, isEmpty: false, lastReply: reply });
    advance(0);
    expect(result.current).toBe('responding');
    advance(RESPONDING_MS);
    expect(result.current).toBe('success');
    advance(SUCCESS_MS);
    expect(result.current).toBe('idle');
    // Re-rendering with the same reply never replays it.
    rerender({ ...base, isEmpty: false, lastReply: reply });
    advance(5000);
    expect(result.current).toBe('idle');
  });

  it('never Success on handoff, even with tool data', () => {
    const { result, rerender } = setup();
    rerender({ ...base, isSending: true, isEmpty: false });
    advance(500);
    rerender({ ...base, isEmpty: false, lastReply: { seq: 1, toolSuccess: true, handoff: true } });
    advance(0);
    expect(result.current).toBe('responding');
    advance(RESPONDING_MS);
    expect(result.current).toBe('idle');
  });

  it('error: back to Idle after the minimum Thinking time, no Responding or Success', () => {
    const { result, rerender } = setup();
    rerender({ ...base, isSending: true, isEmpty: false });
    advance(50);
    rerender({ ...base, isSending: false, isEmpty: false });
    expect(result.current).toBe('thinking');
    advance(THINKING_MIN_MS);
    expect(result.current).toBe('idle');
    advance(3000);
    expect(result.current).toBe('idle');
  });
});
