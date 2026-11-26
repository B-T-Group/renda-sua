import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DASHBOARD_BY_STATUS } from './export-orders.queries';

@Injectable()
export class ExportOrdersDashboardService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async summary() {
    const res = await this.hasura.executeQuery<{
      export_orders: Array<{
        id: string;
        status: string;
        country_code: string;
        grand_total: number | null;
        deposit_amount: number | null;
        balance_amount: number | null;
        balance_option: string | null;
        currency: string;
      }>;
    }>(DASHBOARD_BY_STATUS);
    const byStatus: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    let arDeposit = 0;
    let arBalance = 0;
    let financed = 0;
    for (const row of res.export_orders ?? []) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byCountry[row.country_code] = (byCountry[row.country_code] || 0) + 1;
      if (row.status === 'DEPOSIT_REQUIRED') {
        arDeposit += Number(row.deposit_amount || 0);
      }
      if (row.status === 'BALANCE_REQUIRED') {
        arBalance += Number(row.balance_amount || 0);
      }
      if (row.status === 'FINANCED_30' || row.status === 'FINANCED_60') {
        financed += Number(row.balance_amount || 0);
      }
    }
    return {
      byStatus,
      byCountry,
      accountsReceivable: { deposits: arDeposit, balances: arBalance },
      openFinancing: financed,
      totalOrders: res.export_orders?.length ?? 0,
    };
  }
}
