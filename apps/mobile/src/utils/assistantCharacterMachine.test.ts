import { describe, expect, it } from 'vitest';
import {
  CHAT_CHARACTER_TIMING as T,
  chatCharacterNextWakeAt,
  chatCharacterState,
  headerCharacterState,
  initialChatCharacterMachine,
  reduceChatCharacter,
  type ChatCharacterEvent,
  type ChatCharacterMachine,
} from './assistantCharacterMachine';

function run(events: [number, ChatCharacterEvent][], start = initialChatCharacterMachine) {
  let m: ChatCharacterMachine = start;
  for (const [t, e] of events) m = reduceChatCharacter(m, e, t);
  return m;
}

describe('assistant character machine', () => {
  it('idle by default; attentive when the composer is focused; listening once non-empty', () => {
    expect(chatCharacterState(initialChatCharacterMachine, 0)).toBe('idle');
    let m = run([[0, { type: 'composer', focused: true, nonEmpty: false }]]);
    expect(chatCharacterState(m, 0)).toBe('attentive');
    m = reduceChatCharacter(m, { type: 'composer', focused: true, nonEmpty: true }, 10);
    expect(chatCharacterState(m, 10)).toBe('listening');
    m = reduceChatCharacter(m, { type: 'composer', focused: false, nonEmpty: true }, 20);
    expect(chatCharacterState(m, 20)).toBe('idle');
  });

  it('thinking while sending, then responding for 900 ms, then back to the composer state', () => {
    const m = run([
      [0, { type: 'send' }],
      [1000, { type: 'settled', outcome: 'reply' }],
    ]);
    expect(chatCharacterState(run([[0, { type: 'send' }]]), 500)).toBe('thinking');
    expect(chatCharacterState(m, 1000)).toBe('responding');
    expect(chatCharacterState(m, 1000 + T.responding - 1)).toBe('responding');
    expect(chatCharacterState(m, 1000 + T.responding)).toBe('idle');
  });

  it('holds thinking at least 400 ms on a fast reply (no flicker)', () => {
    const m = run([
      [0, { type: 'send' }],
      [50, { type: 'settled', outcome: 'reply' }],
    ]);
    expect(chatCharacterState(m, 50)).toBe('thinking');
    expect(chatCharacterState(m, 399)).toBe('thinking');
    expect(chatCharacterNextWakeAt(m, 50)).toBe(400);
    expect(chatCharacterState(m, 400)).toBe('responding');
    expect(chatCharacterState(m, 400 + T.responding)).toBe('idle');
  });

  it('success follows responding only for a successful tool result, for ≤ 1.2 s', () => {
    const m = run([
      [0, { type: 'send' }],
      [600, { type: 'settled', outcome: 'reply', toolSuccess: true }],
    ]);
    expect(chatCharacterState(m, 600)).toBe('responding');
    const successAt = 600 + T.responding;
    expect(chatCharacterState(m, successAt)).toBe('success');
    expect(chatCharacterState(m, successAt + T.success - 1)).toBe('success');
    expect(chatCharacterState(m, successAt + T.success)).toBe('idle');
    expect(chatCharacterNextWakeAt(m, 600)).toBe(successAt);
    expect(chatCharacterNextWakeAt(m, successAt)).toBe(successAt + T.success);
  });

  it('success plays at most once per reply', () => {
    let m = run([
      [0, { type: 'send' }],
      [600, { type: 'settled', outcome: 'reply', toolSuccess: true }],
    ]);
    m = reduceChatCharacter(m, { type: 'tick' }, 600 + T.responding);
    m = reduceChatCharacter(m, { type: 'tick' }, 600 + T.responding + T.success);
    // Further ticks and composer changes never replay it.
    m = reduceChatCharacter(m, { type: 'composer', focused: true, nonEmpty: false }, 5000);
    expect(chatCharacterState(m, 5000)).toBe('attentive');
    expect(chatCharacterNextWakeAt(m, 5000)).toBeNull();
    // A duplicate settle without a new send is ignored.
    m = reduceChatCharacter(m, { type: 'settled', outcome: 'reply', toolSuccess: true }, 6000);
    expect(chatCharacterState(m, 6000)).toBe('attentive');
  });

  it('never succeeds on error or handoff', () => {
    const err = run([
      [0, { type: 'send' }],
      [700, { type: 'settled', outcome: 'error', toolSuccess: true }],
    ]);
    expect(chatCharacterState(err, 700)).toBe('idle');
    const handoff = run([
      [0, { type: 'send' }],
      [700, { type: 'settled', outcome: 'handoff', toolSuccess: true }],
    ]);
    expect(chatCharacterState(handoff, 700)).toBe('responding');
    expect(chatCharacterState(handoff, 700 + T.responding)).toBe('idle');
    expect(chatCharacterState(handoff, 700 + T.responding + 100)).toBe('idle');
  });

  it('a fast error still shows thinking for 400 ms, then idle (no sad face)', () => {
    const m = run([
      [0, { type: 'send' }],
      [100, { type: 'settled', outcome: 'error' }],
    ]);
    expect(chatCharacterState(m, 300)).toBe('thinking');
    expect(chatCharacterState(m, 400)).toBe('idle');
  });

  it('priority: responding beats listening; success beats everything', () => {
    let m = run([
      [0, { type: 'composer', focused: true, nonEmpty: true }],
      [0, { type: 'send' }],
      [500, { type: 'settled', outcome: 'reply', toolSuccess: true }],
    ]);
    expect(chatCharacterState(m, 500)).toBe('responding');
    m = reduceChatCharacter(m, { type: 'composer', focused: true, nonEmpty: true }, 600);
    expect(chatCharacterState(m, 600)).toBe('responding');
    expect(chatCharacterState(m, 500 + T.responding)).toBe('success');
    expect(chatCharacterState(m, 500 + T.responding + T.success)).toBe('listening');
  });

  it('a new send cancels a pending outcome and restarts thinking', () => {
    let m = run([
      [0, { type: 'send' }],
      [100, { type: 'settled', outcome: 'reply', toolSuccess: true }],
    ]);
    m = reduceChatCharacter(m, { type: 'send' }, 200);
    expect(chatCharacterState(m, 500)).toBe('thinking');
    expect(chatCharacterState(m, 5000)).toBe('thinking');
  });

  it('reset (start over / thread rotation) clears timers but keeps the composer', () => {
    let m = run([
      [0, { type: 'composer', focused: true, nonEmpty: false }],
      [0, { type: 'send' }],
    ]);
    m = reduceChatCharacter(m, { type: 'reset' }, 100);
    expect(chatCharacterState(m, 100)).toBe('attentive');
    expect(chatCharacterNextWakeAt(m, 100)).toBeNull();
  });

  it('header avatar maps attentive/listening to idle', () => {
    expect(headerCharacterState('attentive')).toBe('idle');
    expect(headerCharacterState('listening')).toBe('idle');
    expect(headerCharacterState('thinking')).toBe('thinking');
    expect(headerCharacterState('success')).toBe('success');
  });
});
