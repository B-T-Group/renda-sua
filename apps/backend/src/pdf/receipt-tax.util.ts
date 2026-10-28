export interface ReceiptTaxInput {
  tax_amount?: number | string | null;
  total_amount: number | string;
  tax_jurisdiction?: { state?: string; country?: string } | null;
  tax_snapshot?: {
    status?: string | null;
    total_including_tax?: number | string | null;
    captured_total_including_tax?: number | string | null;
  } | null;
}

export interface ReceiptTaxView {
  taxAmount: number;
  totalAmount: number;
  /** Only when tax was actually charged: never a jurisdiction next to a zero tax line. */
  showJurisdiction: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What the receipt prints for tax and total.
 *
 * Calculation-based (PaymentIntent) orders keep a PRE-tax ledger: orders.total_amount and
 * orders.tax_amount (0) are what the wallet, payouts and the fee base use, while the card was
 * charged tax-inclusive. For an order with a finalized tax snapshot the receipt therefore
 * shows the tax actually collected (charged - ledger) and the amount actually charged.
 * Orders whose ledger already includes tax (hosted Checkout, legacy rewrites: tax_amount > 0)
 * and orders without a finalized snapshot print their own columns unchanged.
 */
export function resolveReceiptTax(order: ReceiptTaxInput): ReceiptTaxView {
  const ledgerTotal = Number(order.total_amount) || 0;
  const orderTax = Number(order.tax_amount) || 0;
  const snap = order.tax_snapshot;
  if (orderTax <= 0 && snap?.status === 'finalized') {
    const charged = Number(
      snap.captured_total_including_tax ?? snap.total_including_tax ?? 0
    );
    if (charged > ledgerTotal) {
      return {
        taxAmount: round2(charged - ledgerTotal),
        totalAmount: round2(charged),
        showJurisdiction: true,
      };
    }
  }
  return {
    taxAmount: orderTax,
    totalAmount: ledgerTotal,
    showJurisdiction: orderTax > 0,
  };
}
