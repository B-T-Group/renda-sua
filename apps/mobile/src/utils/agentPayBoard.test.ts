import { describe, expect, it } from 'vitest';
import { commissionDeadlineTone, itemsForSegment, progressFromObjectives } from './agentPayBoard';
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

  it('marks a past commission deadline expired and a near one as soon', () => {
    const now = Date.parse('2026-10-10T12:00:00.000Z');
    const day = 24 * 60 * 60 * 1000;
    expect(commissionDeadlineTone('2026-10-09T12:00:00.000Z', false, now)).toBe('expired');
    expect(commissionDeadlineTone(new Date(now + 2 * day).toISOString(), false, now)).toBe('soon');
    expect(commissionDeadlineTone(new Date(now + 4 * day).toISOString(), false, now)).toBe('normal');
    expect(commissionDeadlineTone('2026-10-01T00:00:00.000Z', true, now)).toBe('normal');
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
