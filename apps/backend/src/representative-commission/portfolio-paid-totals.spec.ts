import {
  livePortfolioPending,
  portfolioTotalsFromSums,
  readPortfolioSums,
  type PortfolioPaidSums,
} from './portfolio-paid-totals';

const empty: PortfolioPaidSums = {
  creditedPayable: 0,
  creditedRecruitment: 0,
  openPayable: 0,
  openRecruitment: 0,
  releasedHolds: 0,
};

describe('portfolio paid totals', () => {
  it('keeps every credited payout and released hold in earned', () => {
    const totals = portfolioTotalsFromSums(
      { ...empty, creditedPayable: 1260, creditedRecruitment: 8000, releasedHolds: 140 },
      0
    );
    expect(totals).toEqual({ earned: 9400, pending: 0 });
  });

  it('counts an unsaved open month once and leaves a saved open month in the statement sum', () => {
    const month = { status: 'open', payableAmount: 500, recruitmentAmount: 0 };
    expect(livePortfolioPending(false, month)).toBe(500);
    expect(livePortfolioPending(true, month)).toBe(0);
    expect(portfolioTotalsFromSums({ ...empty, openPayable: 900 }, 0)).toEqual({
      earned: 0,
      pending: 900,
    });
  });

  it('returns null when nothing has been earned or is still open', () => {
    expect(portfolioTotalsFromSums(empty, 0)).toBeNull();
    expect(livePortfolioPending(false, { status: 'credited', payableAmount: 10, recruitmentAmount: 0 })).toBe(0);
  });

  it('reads numeric strings and missing sums as amounts', () => {
    expect(
      readPortfolioSums({
        credited: { aggregate: { sum: { payable_amount: '1260', recruitment_amount: null } } },
        holds: { aggregate: { sum: { amount: '140' } } },
      })
    ).toEqual({ ...empty, creditedPayable: 1260, releasedHolds: 140 });
  });
});
