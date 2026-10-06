import { describe, expect, it } from 'vitest';
import { replyHasToolSuccess, replyOutcome } from './assistantReplyOutcome';

describe('assistant reply outcome', () => {
  it('today\u2019s { reply, handoff } payload never counts as a tool success', () => {
    expect(replyHasToolSuccess({ reply: 'Hello', handoff: false })).toBe(false);
    expect(replyHasToolSuccess(null)).toBe(false);
  });

  it('item / store / order / reorder blocks are tool successes', () => {
    for (const kind of ['item', 'store', 'order', 'reorder']) {
      expect(replyHasToolSuccess({ reply: 'x', blocks: [{ kind }] })).toBe(true);
    }
  });

  it('link-only blocks, malformed blocks and handoff are not', () => {
    expect(replyHasToolSuccess({ reply: 'x', blocks: [{ kind: 'link' }] })).toBe(false);
    expect(replyHasToolSuccess({ reply: 'x', blocks: [null, 3, {}] })).toBe(false);
    expect(replyHasToolSuccess({ reply: 'x', blocks: 'item' })).toBe(false);
    expect(replyHasToolSuccess({ reply: 'x', handoff: true, blocks: [{ kind: 'order' }] })).toBe(false);
  });

  it('classifies the outcome', () => {
    expect(replyOutcome({ reply: 'hi' })).toBe('reply');
    expect(replyOutcome({ reply: 'hi', handoff: true })).toBe('handoff');
    expect(replyOutcome({ reply: '   ' })).toBe('error');
    expect(replyOutcome(undefined)).toBe('error');
  });
});
