import { resolveReceiptTax } from './receipt-tax.util';

describe('resolveReceiptTax', () => {
  const finalized = { status: 'finalized', total_including_tax: 113, captured_total_including_tax: 113 };

  it('shows the tax collected and the amount charged for a finalized pre-tax-ledger order', () => {
    expect(
      resolveReceiptTax({ total_amount: 100, tax_amount: 0, tax_jurisdiction: { state: 'ON', country: 'CA' }, tax_snapshot: finalized })
    ).toEqual({ taxAmount: 13, totalAmount: 113, showJurisdiction: true });
  });

  it('prefers the captured total over the estimate (fee-waiver partial capture)', () => {
    expect(
      resolveReceiptTax({
        total_amount: 90,
        tax_amount: 0,
        tax_snapshot: { status: 'finalized', total_including_tax: 113, captured_total_including_tax: 101.7 },
      })
    ).toEqual({ taxAmount: 11.7, totalAmount: 101.7, showJurisdiction: true });
  });

  it('falls back to the estimated total when the captured total is missing', () => {
    expect(
      resolveReceiptTax({ total_amount: '100', tax_amount: '0', tax_snapshot: { status: 'finalized', total_including_tax: '113' } })
    ).toMatchObject({ taxAmount: 13, totalAmount: 113 });
  });

  it('never prints a jurisdiction next to a zero tax line', () => {
    for (const tax_snapshot of [null, undefined, { status: 'estimated', total_including_tax: 113 }, { status: 'void', total_including_tax: 113 }]) {
      expect(
        resolveReceiptTax({ total_amount: 100, tax_amount: 0, tax_jurisdiction: { state: 'ON' }, tax_snapshot })
      ).toEqual({ taxAmount: 0, totalAmount: 100, showJurisdiction: false });
    }
  });

  it('a ledger that already includes tax (hosted Checkout / legacy rewrite) prints its own columns', () => {
    expect(resolveReceiptTax({ total_amount: 113, tax_amount: 13, tax_snapshot: finalized })).toEqual({
      taxAmount: 13,
      totalAmount: 113,
      showJurisdiction: true,
    });
  });

  it('ignores a finalized snapshot whose charged amount is not above the ledger', () => {
    expect(
      resolveReceiptTax({ total_amount: 100, tax_amount: 0, tax_snapshot: { status: 'finalized', captured_total_including_tax: 100 } })
    ).toEqual({ taxAmount: 0, totalAmount: 100, showJurisdiction: false });
  });
});
