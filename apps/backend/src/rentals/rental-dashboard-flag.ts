export interface DashboardRequestFlagRow {
  boolean_value: boolean | null;
  country_code: string | null;
}

/** Country row wins. Otherwise the global row. Missing rows stay off. */
export function dashboardRequestsEnabled(
  rows: DashboardRequestFlagRow[],
  country?: string | null
): boolean {
  const code = (country ?? '').trim().toUpperCase();
  if (code) {
    const countryRow = rows.find((row) => (row.country_code ?? '').toUpperCase() === code);
    if (countryRow?.boolean_value != null) return countryRow.boolean_value === true;
  }
  const globalRow = rows.find((row) => row.country_code == null);
  return globalRow?.boolean_value === true;
}
