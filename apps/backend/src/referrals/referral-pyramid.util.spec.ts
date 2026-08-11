import {
  buildReferralBonusMemo,
  referralReferenceUuid,
  splitReferralBonus,
} from './referral-pyramid.util';

describe('referral-pyramid.util', () => {
  describe('splitReferralBonus', () => {
    const percents = { gen1: 5, gen2: 3, gen3: 1 };

    it('keeps full gross with no ancestors', () => {
      expect(splitReferralBonus(5000, percents, 0)).toEqual([
        { generation: 0, amount: 5000 },
      ]);
    });

    it('splits 5% to gen1', () => {
      expect(splitReferralBonus(5000, percents, 1)).toEqual([
        { generation: 0, amount: 4750 },
        { generation: 1, amount: 250 },
      ]);
    });

    it('splits 5% + 3% for two ancestors', () => {
      expect(splitReferralBonus(5000, percents, 2)).toEqual([
        { generation: 0, amount: 4600 },
        { generation: 1, amount: 250 },
        { generation: 2, amount: 150 },
      ]);
    });

    it('splits 5% + 3% + 1% for three ancestors', () => {
      expect(splitReferralBonus(5000, percents, 3)).toEqual([
        { generation: 0, amount: 4550 },
        { generation: 1, amount: 250 },
        { generation: 2, amount: 150 },
        { generation: 3, amount: 50 },
      ]);
    });

    it('floors percents and leaves remainder with earner', () => {
      expect(splitReferralBonus(100, percents, 3)).toEqual([
        { generation: 0, amount: 91 },
        { generation: 1, amount: 5 },
        { generation: 2, amount: 3 },
        { generation: 3, amount: 1 },
      ]);
    });

    it('clamps upline shares so total never exceeds gross', () => {
      expect(
        splitReferralBonus(100, { gen1: 80, gen2: 50, gen3: 40 }, 3)
      ).toEqual([
        { generation: 1, amount: 80 },
        { generation: 2, amount: 20 },
      ]);
    });
  });

  describe('buildReferralBonusMemo', () => {
    it('describes earner bonus source', () => {
      expect(
        buildReferralBonusMemo({
          generation: 0,
          earnerName: 'Ada',
          referredKind: 'business',
          referredName: 'Shop',
          referredId: 'biz-1',
        })
      ).toBe('Referral bonus for referring Business "Shop" (biz-1)');
    });

    it('describes pyramid level source', () => {
      expect(
        buildReferralBonusMemo({
          generation: 2,
          percent: 3,
          earnerName: 'Ada',
          referredKind: 'agent',
          referredName: 'Bob',
          referredId: 'agent-1',
        })
      ).toBe(
        "Referral pyramid L2 (3%) from Ada's bonus for referring Agent \"Bob\" (agent-1)"
      );
    });
  });

  describe('referralReferenceUuid', () => {
    it('is stable for the same seed', () => {
      expect(referralReferenceUuid('a')).toBe(referralReferenceUuid('a'));
      expect(referralReferenceUuid('a')).not.toBe(referralReferenceUuid('b'));
    });
  });
});
