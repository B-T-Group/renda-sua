import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type { MobileTransactionStatus } from './mobile-payments.service';

export function buildMypvitReplayDto(
  tx: MobilePaymentTransaction,
  live: MobileTransactionStatus,
  nationalCustomerId: string
): MyPVitCallbackDto {
  const ok = live.status === 'success';
  return {
    transactionId: live.transactionId || tx.transaction_id || '',
    merchantReferenceId: tx.reference,
    status: ok ? 'SUCCESS' : 'FAILED',
    amount: Number(live.amount ?? tx.amount),
    customerID: nationalCustomerId,
    fees: 0,
    chargeOwner: 'CUSTOMER',
    transactionOperation: 'PAYMENT',
    operator: 'MOBILE_MONEY',
    code: ok ? 200 : 400,
  };
}

export function buildFreemopayReplayDto(
  tx: MobilePaymentTransaction,
  live: MobileTransactionStatus
): FreemopayCallbackDto {
  const ok = live.status === 'success';
  return {
    reference: tx.transaction_id || '',
    externalId: tx.reference,
    status: ok ? 'SUCCESS' : 'FAILED',
    amount: Number(live.amount ?? tx.amount),
    reason: ok ? undefined : live.message || 'Payment failed',
    message: live.message,
  };
}
