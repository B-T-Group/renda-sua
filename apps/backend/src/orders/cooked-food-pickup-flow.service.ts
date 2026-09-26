import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrderStatusService } from './order-status.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

export const COOKED_FOOD_WHATSAPP_READY_MINUTES = 30;
const MIN_READY_MINUTES = 5;
const MAX_READY_MINUTES = 180;
const READY_PRESETS = new Set([15, 30, 45, 60]);

export type CookedFoodPickupOrderRow = {
  id: string;
  order_number: string;
  current_status: string;
  payment_status?: string | null;
  payment_timing?: string | null;
  fulfillment_method?: string | null;
  fulfillment_timing?: string | null;
  is_cooked_food_pickup?: boolean | null;
  pay_after_merchant_confirm?: boolean | null;
  estimated_prep_minutes?: number | null;
  promised_ready_at?: string | null;
  business_id: string;
  business?: {
    user_id?: string | null;
    user?: { preferred_language?: string | null } | null;
  } | null;
  business_location_id?: string | null;
  client?: { user_id?: string | null } | null;
};

/**
 * Cooked-food ASAP: ready-in confirm helpers, auto-mark-ready and
 * unpaid auto-cancel scheduling (pickup cohort, or MoMo delivery pay-after).
 */
@Injectable()
export class CookedFoodPickupFlowService {
  private readonly logger = new Logger(CookedFoodPickupFlowService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly configService: ConfigService<Configuration>,
    private readonly waitAndExecute: WaitAndExecuteScheduleService,
    private readonly orderStatusService: OrderStatusService
  ) {}

  /** Durable pickup flag — used for no-PIN complete and pickup-only UX. */
  isCookedFoodPickupCohort(order: {
    is_cooked_food_pickup?: boolean | null;
    fulfillment_method?: string | null;
  }): boolean {
    return (
      order.is_cooked_food_pickup === true &&
      order.fulfillment_method === 'pickup'
    );
  }

  /**
   * Ready-in confirm + auto-mark-ready cohort: cooked-food pickup, or
   * MoMo delivery with pay_after_merchant_confirm.
   */
  isCookedFoodAsapReadyInCohort(order: {
    is_cooked_food_pickup?: boolean | null;
    fulfillment_method?: string | null;
    pay_after_merchant_confirm?: boolean | null;
  }): boolean {
    if (this.isCookedFoodPickupCohort(order)) return true;
    return (
      order.fulfillment_method === 'delivery' &&
      order.pay_after_merchant_confirm === true
    );
  }

  isPayAfterMerchantConfirm(order: {
    pay_after_merchant_confirm?: boolean | null;
  }): boolean {
    return order.pay_after_merchant_confirm === true;
  }

  normalizeReadyInMinutes(raw?: number | null): number {
    if (raw == null || !Number.isFinite(raw)) {
      return COOKED_FOOD_WHATSAPP_READY_MINUTES;
    }
    const minutes = Math.round(Number(raw));
    if (READY_PRESETS.has(minutes)) return minutes;
    if (minutes < MIN_READY_MINUTES || minutes > MAX_READY_MINUTES) {
      throw new HttpException(
        `ready_in_minutes must be 15, 30, 45, 60, or between ${MIN_READY_MINUTES} and ${MAX_READY_MINUTES}`,
        HttpStatus.BAD_REQUEST
      );
    }
    return minutes;
  }

  whatsappDefaultReadyMinutes(): number {
    return COOKED_FOOD_WHATSAPP_READY_MINUTES;
  }

  async writeEstimatedPrepMinutes(
    orderId: string,
    minutes: number
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation SetEstimatedPrep($id: uuid!, $minutes: Int!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { estimated_prep_minutes: $minutes }
        ) { id }
      }`,
      { id: orderId, minutes }
    );
  }

  async clearEstimatedPrepMinutes(orderId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ClearEstimatedPrep($id: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { estimated_prep_minutes: null }
        ) { id }
      }`,
      { id: orderId }
    );
  }

  /**
   * Drop any prior ASAP promise so the next persist anchors from now
   * (used when prep should start at client payment, not order create / confirm).
   */
  async clearPromisedReady(orderId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ClearPromisedReady($id: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { promised_ready_at: null, promised_fulfill_by: null }
        ) { id }
      }`,
      { id: orderId }
    );
  }

  /** Full ready-in duration from estimated prep (clock starts at payment). */
  readySecondsFromEstimatedPrep(order: {
    estimated_prep_minutes?: number | null;
  }): number {
    const minutes =
      order.estimated_prep_minutes ?? COOKED_FOOD_WHATSAPP_READY_MINUTES;
    return Math.max(1, Math.round(Number(minutes)) * 60);
  }

  async enterPreparingAndScheduleReady(
    orderId: string,
    readyInMinutes: number
  ): Promise<void> {
    await this.orderStatusService.updateOrderStatus(orderId, 'preparing', {
      viaSystem: true,
    });
    await this.scheduleAutoMarkReady(orderId, readyInMinutes * 60);
  }

  async scheduleAutoMarkReady(
    orderId: string,
    waitSeconds: number
  ): Promise<void> {
    try {
      await this.waitAndExecute.scheduleAcceptanceTimeout(
        'order.auto_mark_ready',
        { order_id: orderId },
        Math.max(1, waitSeconds)
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to schedule auto-mark-ready for ${orderId}: ${error?.message}`
      );
    }
  }

  async scheduleUnpaidCancelAfterConfirm(orderId: string): Promise<void> {
    const hours =
      this.configService.get<Configuration['order']>('order')
        ?.cookedFoodUnpaidCancelHours ?? 3;
    try {
      await this.waitAndExecute.scheduleAcceptanceTimeout(
        'order.cooked_food_unpaid_cancel',
        { order_id: orderId },
        Math.max(60, hours * 3600)
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to schedule unpaid cancel for ${orderId}: ${error?.message}`
      );
    }
  }

  async shouldAutoMarkReady(orderId: string): Promise<{
    success: boolean;
    shouldMarkReady: boolean;
    reason?: string;
  }> {
    const order = await this.loadOrder(orderId);
    if (!order) {
      return { success: false, shouldMarkReady: false, reason: 'order_not_found' };
    }
    if (!this.isCookedFoodAsapReadyInCohort(order)) {
      return { success: true, shouldMarkReady: false, reason: 'not_cohort' };
    }
    if (order.current_status !== 'preparing') {
      return { success: true, shouldMarkReady: false, reason: 'not_preparing' };
    }
    const paid =
      order.payment_status === 'paid' ||
      order.payment_status === 'authorized';
    if (!paid) {
      return { success: true, shouldMarkReady: false, reason: 'unpaid' };
    }
    return { success: true, shouldMarkReady: true };
  }

  async shouldCancelUnpaid(orderId: string): Promise<{
    success: boolean;
    shouldCancel: boolean;
    reason?: string;
  }> {
    const order = await this.loadOrder(orderId);
    if (!order) {
      return { success: false, shouldCancel: false, reason: 'order_not_found' };
    }
    if (!this.isPayAfterMerchantConfirm(order)) {
      return {
        success: true,
        shouldCancel: false,
        reason: 'not_pay_after_confirm',
      };
    }
    if (
      order.payment_status === 'paid' ||
      order.payment_status === 'authorized'
    ) {
      return { success: true, shouldCancel: false, reason: 'already_paid' };
    }
    if (order.current_status !== 'confirmed') {
      return {
        success: true,
        shouldCancel: false,
        reason: 'not_awaiting_payment',
      };
    }
    return { success: true, shouldCancel: true };
  }

  remainingReadySeconds(order: {
    promised_ready_at?: string | null;
    estimated_prep_minutes?: number | null;
  }): number {
    if (order.promised_ready_at) {
      const ms = new Date(order.promised_ready_at).getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / 1000));
    }
    return this.readySecondsFromEstimatedPrep(order);
  }

  shouldSkipMarkReadyPrompt(order: {
    is_cooked_food_pickup?: boolean | null;
  }): boolean {
    return order.is_cooked_food_pickup === true;
  }

  async loadOrder(
    orderId: string
  ): Promise<CookedFoodPickupOrderRow | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: CookedFoodPickupOrderRow | null;
    }>(
      `query CookedFoodPickupOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status payment_status payment_timing
          fulfillment_method fulfillment_timing
          is_cooked_food_pickup pay_after_merchant_confirm
          estimated_prep_minutes promised_ready_at
          business_id business_location_id
          business { user_id user { preferred_language } }
          client { user_id }
        }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }
}
