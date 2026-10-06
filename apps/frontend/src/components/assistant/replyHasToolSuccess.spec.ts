import { replyHasToolSuccess } from '../../contexts/AssistantChatContext';

describe('replyHasToolSuccess (Success trigger)', () => {
  it.each([
    ['plain FAQ answer (today’s contract)', { reply: 'x', handoff: false }, false],
    ['link-only blocks', { reply: 'x', handoff: false, blocks: [{ kind: 'link' }] }, false],
    ['order found', { reply: 'x', handoff: false, blocks: [{ kind: 'order' }] }, true],
    ['items found', { reply: 'x', handoff: false, blocks: [{ kind: 'link' }, { kind: 'item' }] }, true],
    ['store found', { reply: 'x', handoff: false, blocks: [{ kind: 'store' }] }, true],
    ['reorder ready', { reply: 'x', handoff: false, blocks: [{ kind: 'reorder' }] }, true],
    ['handoff, even with results', { reply: 'x', handoff: true, blocks: [{ kind: 'order' }] }, false],
    ['malformed blocks', { reply: 'x', handoff: false, blocks: [null, { kind: 3 }] }, false],
  ])('%s → %s', (_label, data, expected) => {
    expect(replyHasToolSuccess(data as never)).toBe(expected);
  });
  it('handles missing data', () => {
    expect(replyHasToolSuccess(null)).toBe(false);
    expect(replyHasToolSuccess(undefined)).toBe(false);
  });
});
