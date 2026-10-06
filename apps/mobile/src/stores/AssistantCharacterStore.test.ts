import { describe, expect, it } from 'vitest';
import { observable, runInAction } from 'mobx';
import { AssistantCharacterStore, type CharacterClock } from './AssistantCharacterStore';
import type { AssistantSettle } from './AssistantStore';

function fakeClock() {
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const clock: CharacterClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimeout: (h) => {
      timers = timers.filter((t) => t.id !== h);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      now = due.at;
      due.fn();
    }
    now = end;
  };
  return { clock, advance, pending: () => timers.length };
}

function setup() {
  const source = observable({ isSending: false, threadId: 't1', lastSettle: null as AssistantSettle | null });
  const c = fakeClock();
  const store = new AssistantCharacterStore(source, c.clock);
  let seq = 0;
  const settle = (outcome: AssistantSettle['outcome'], toolSuccess = false) =>
    runInAction(() => {
      source.isSending = false;
      source.lastSettle = { seq: ++seq, outcome, toolSuccess };
    });
  const send = () => runInAction(() => (source.isSending = true));
  return { source, store, settle, send, ...c };
}

describe('AssistantCharacterStore', () => {
  it('idle → attentive → listening from the composer', () => {
    const { store } = setup();
    expect(store.state).toBe('idle');
    store.setComposer(true, false);
    expect(store.state).toBe('attentive');
    store.setComposer(true, true);
    expect(store.state).toBe('listening');
    store.setComposer(false, true);
    expect(store.state).toBe('idle');
  });

  it('holds Thinking ≥ 400 ms on a fast reply, then Responding → Idle', () => {
    const { store, send, settle, advance } = setup();
    send();
    expect(store.state).toBe('thinking');
    advance(100);
    settle('reply');
    expect(store.state).toBe('thinking');
    advance(299);
    expect(store.state).toBe('thinking');
    advance(1);
    expect(store.state).toBe('responding');
    advance(900);
    expect(store.state).toBe('idle');
  });

  it('Success only after a successful tool result, once', () => {
    const { store, send, settle, advance } = setup();
    send();
    advance(500);
    settle('reply', true);
    expect(store.state).toBe('responding');
    advance(900);
    expect(store.state).toBe('success');
    advance(1200);
    expect(store.state).toBe('idle');
    advance(5000);
    expect(store.state).toBe('idle');
  });

  it('error and handoff go back to Idle with no Success', () => {
    const { store, send, settle, advance } = setup();
    send();
    advance(500);
    settle('error', true);
    expect(store.state).toBe('idle');
    send();
    advance(500);
    settle('handoff', true);
    advance(900);
    expect(store.state).not.toBe('success');
    advance(2000);
    expect(store.state).toBe('idle');
  });

  it('a new thread resets; dispose clears the timer', () => {
    const { store, source, send, pending } = setup();
    send();
    runInAction(() => {
      source.isSending = false;
      source.threadId = 't2';
    });
    expect(store.state).toBe('idle');
    store.dispose();
    expect(pending()).toBe(0);
  });
});
