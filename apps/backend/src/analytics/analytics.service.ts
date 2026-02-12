import { Injectable, Logger } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface BusinessAnalytics {
  orderCountByStatus: Array<{ status: string; count: number }>;
  totalRevenue: number;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  topItems: Array<{ itemName: string; quantity: number; totalRevenue: number }>;
  revenueByPeriod: Array<{ period: string; revenue: number; count: number }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Get business analytics for a given business ID. Caller must ensure the user has access to this business.
   */
  async getBusinessAnalytics(
    businessId: string,
    startDate?: string,
    endDate?: string
  ): Promise<BusinessAnalytics> {
    try {
      const orderCountByStatusQuery = `
        query GetOrderCountByStatus($businessId: uuid!) {
          orders_aggregate(where: { business_id: { _eq: $businessId } }) {
            nodes {
              current_status
            }
          }
        }
      `;

      const statusResult = await this.hasuraSystemService.executeQuery(
        orderCountByStatusQuery,
        { businessId }
      );
      const nodes = (statusResult?.orders_aggregate?.nodes as { current_status: string }[]) ?? [];
      const statusCounts = nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.current_status] = (acc[n.current_status] ?? 0) + 1;
        return acc;
      }, {});
      const orderCountByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));

      const revenueQuery = `
        query GetRevenue($businessId: uuid!) {
          orders_aggregate(
            where: {
              business_id: { _eq: $businessId }
              current_status: { _in: ["delivered", "complete"] }
            }
          ) {
            aggregate {
              sum {
                total_amount
              }
              count
            }
          }
        }
      `;
      const revenueResult = await this.hasuraSystemService.executeQuery(
        revenueQuery,
        { businessId }
      );
      const revenueAgg = revenueResult?.orders_aggregate?.aggregate;
      const totalRevenue = Number(revenueAgg?.sum?.total_amount ?? 0);
      const deliveredCount = Number(revenueAgg?.count ?? 0);

      const totalOrdersQuery = `
        query GetTotalOrders($businessId: uuid!) {
          orders_aggregate(where: { business_id: { _eq: $businessId } }) {
            aggregate {
              count
            }
          }
        }
      `;
      const totalResult = await this.hasuraSystemService.executeQuery(
        totalOrdersQuery,
        { businessId }
      );
      const orderCount = Number(
        totalResult?.orders_aggregate?.aggregate?.count ?? 0
      );

      const cancelledQuery = `
        query GetCancelled($businessId: uuid!) {
          orders_aggregate(
            where: {
              business_id: { _eq: $businessId }
              current_status: { _in: ["cancelled", "failed", "refunded"] }
            }
          ) {
            aggregate {
              count
            }
          }
        }
      `;
      const cancelledResult = await this.hasuraSystemService.executeQuery(
        cancelledQuery,
        { businessId }
      );
      const cancelledCount = Number(
        cancelledResult?.orders_aggregate?.aggregate?.count ?? 0
      );

      const topItemsQuery = `
        query GetTopItems($businessId: uuid!) {
          order_items(
            where: { order: { business_id: { _eq: $businessId }, current_status: { _in: ["delivered", "complete"] } } }
            order_by: { quantity: desc }
            limit: 10
          ) {
            item_name
            quantity
            total_price
          }
        }
      `;
      const topItemsResult = await this.hasuraSystemService.executeQuery(
        topItemsQuery,
        { businessId }
      );
      const topItemNodes = (topItemsResult?.order_items as Array<{
        item_name: string;
        quantity: number;
        total_price?: number;
      }>) ?? [];
      const itemAgg = topItemNodes.reduce<
        Record<string, { quantity: number; totalRevenue: number }>
      >((acc, row) => {
        const name = row.item_name ?? 'Unknown';
        if (!acc[name]) acc[name] = { quantity: 0, totalRevenue: 0 };
        acc[name].quantity += row.quantity ?? 0;
        acc[name].totalRevenue += Number(row.total_price ?? 0);
        return acc;
      }, {});
      const topItems = Object.entries(itemAgg).map(([itemName, v]) => ({
        itemName,
        quantity: v.quantity,
        totalRevenue: v.totalRevenue,
      }));

      const revenueByPeriodQuery = `
        query GetRevenueByPeriod($businessId: uuid!) {
          orders(
            where: {
              business_id: { _eq: $businessId }
              current_status: { _in: ["delivered", "complete"] }
            }
            order_by: { created_at: asc }
          ) {
            created_at
            total_amount
          }
        }
      `;
      const periodResult = await this.hasuraSystemService.executeQuery(
        revenueByPeriodQuery,
        { businessId }
      );
      const periodOrders = (periodResult?.orders as Array<{
        created_at: string;
        total_amount?: number;
      }>) ?? [];
      const byMonth: Record<string, { revenue: number; count: number }> = {};
      periodOrders.forEach((o) => {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[key]) byMonth[key] = { revenue: 0, count: 0 };
        byMonth[key].revenue += Number(o.total_amount ?? 0);
        byMonth[key].count += 1;
      });
      const revenueByPeriod = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([period, v]) => ({
          period,
          revenue: v.revenue,
          count: v.count,
        }));

      return {
        orderCountByStatus,
        totalRevenue,
        orderCount,
        deliveredCount,
        cancelledCount,
        topItems,
        revenueByPeriod,
      };
    } catch (err: any) {
      this.logger.error('getBusinessAnalytics failed', err);
      throw new HttpException(
        err?.message ?? 'Failed to load analytics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
