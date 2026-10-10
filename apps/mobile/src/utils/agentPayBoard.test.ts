import { describe, expect, it } from 'vitest';
import { itemsForSegment, progressFromObjectives } from './agentPayBoard';
import type { EarningItem } from '../types/agentPayBoard';

describe('agentPayBoard', () => {
  it('builds progress only for objectives that were returned', () => {
    const progress = progressFromObjectives([
      { key: 'merchantRecruitments', actual: 1, target: 4, percent: 25 },
    ]);
    expect(progress.merchantRecruitments).toEqual({ actual: 1, target: 4, percent: 25 });
    expect(progress.itemSales.target).toBeNull();
    expect(progress.overallPercent).toBe(25);
  });

  it('keeps commissions and unknown kinds off the objectives list', () => {
    const items: EarningItem[] = [
      item('merchant_referral'),
      item('payment_schedule'),
      item('future_bonus'),
    ];
    expect(itemsForSegment(items, 'commissions').map((row) => row.kind)).toEqual([
      'merchant_referral',
      'future_bonus',
    ]);
    expect(itemsForSegment(items, 'objectives')).toHaveLength(1);
  });
});

function item(type: string): EarningItem {
  return {
    id: type,
    kind: type,
    paymentStatus: 'unpaid',
    title: type,
    currency: 'XAF',
    deadline: null,
    nextStep: 'add_items',
    structure: { type },
  };
}
