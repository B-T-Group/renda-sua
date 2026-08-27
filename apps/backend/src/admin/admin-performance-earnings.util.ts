export interface CompensationEarningRow {
  earner_agent_id: string;
  business_id: string | null;
  amount: number | string;
  currency: string;
}

export interface AgentEarnedTotals {
  byCurrency: Map<string, number>;
  byBusiness: Map<string, number>;
}

export function emptyEarnedTotals(): AgentEarnedTotals {
  return { byCurrency: new Map(), byBusiness: new Map() };
}

export function groupEarnedByAgent(
  rows: CompensationEarningRow[]
): Map<string, AgentEarnedTotals> {
  const map = new Map<string, AgentEarnedTotals>();
  for (const row of rows) addEarnedRow(map, row);
  return map;
}

export function primaryEarned(totals?: AgentEarnedTotals): {
  amount: number;
  currency: string;
} {
  let best = { amount: 0, currency: 'XAF' };
  if (!totals) return best;
  for (const [currency, amount] of totals.byCurrency) {
    if (amount > best.amount) best = { amount, currency };
  }
  return best;
}

function addEarnedRow(
  map: Map<string, AgentEarnedTotals>,
  row: CompensationEarningRow
): void {
  const agentId = row.earner_agent_id;
  if (!agentId) return;
  const totals = map.get(agentId) ?? emptyEarnedTotals();
  const amount = Number(row.amount) || 0;
  const currency = row.currency || 'XAF';
  totals.byCurrency.set(currency, (totals.byCurrency.get(currency) ?? 0) + amount);
  if (row.business_id) {
    totals.byBusiness.set(
      row.business_id,
      (totals.byBusiness.get(row.business_id) ?? 0) + amount
    );
  }
  map.set(agentId, totals);
}
