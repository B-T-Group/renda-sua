/**
 * A FedaPay callback that the live provider record definitely contradicts (PE-approved
 * webhook-response policy, #587).
 *
 * FedaPay counts every non-2xx response as a failed delivery, retries up to 9 times and then
 * disables the webhook. A definite mismatch will never resolve by retrying (the live record is
 * terminal and authoritative), so it is acknowledged with 2xx instead: no credit, no
 * transaction state change, plus a log line and a money-anomaly alert for manual review.
 * Only transient conditions (FedaPay API / network errors, live status pending or ambiguous)
 * stay 5xx so FedaPay retries.
 *
 * `message` names only the reason and our tx id. Expected/actual values and references live
 * in `detail`, which goes to the log and the alert, never to the HTTP response.
 */
export type CallbackLiveMismatchReason =
  | 'missing_transaction_id'
  | 'live_status_mismatch'
  | 'live_refunded'
  | 'stored_currency_not_xof'
  | 'live_currency_not_xof'
  | 'amount_mismatch'
  | 'missing_stored_reference'
  | 'missing_live_reference'
  | 'reference_mismatch'
  /** #618: a DEV `mock-` row reached the live path (FEDAPAY_MOCK is off): nothing to verify. */
  | 'mock_row_mock_disabled';

export class CallbackLiveMismatchError extends Error {
  override readonly name = 'CallbackLiveMismatchError';
  /** Set once an alert has been raised, so the outer acknowledgement does not alert twice. */
  alerted = false;

  constructor(
    readonly reason: CallbackLiveMismatchReason,
    readonly txId: string,
    readonly claimed: 'SUCCESS' | 'FAILED',
    readonly detail: string
  ) {
    super(`Rejecting FedaPay ${claimed} callback for ${txId}: ${reason}`);
  }
}

/**
 * QA #587 A1: the live FedaPay record is incomplete (no currency or no amount). Transient:
 * the webhook answers 5xx so FedaPay retries. A distinct class (not a plain Error) so the
 * callback processor can count repeats per transaction and alert before FedaPay disables
 * the webhook (it does after 10 consecutive failed deliveries). Message carries no values.
 */
export class LiveRecordIncompleteError extends Error {
  override readonly name = 'LiveRecordIncompleteError';

  constructor(
    readonly txId: string,
    readonly missing: 'currency' | 'amount'
  ) {
    super(`Rejecting SUCCESS callback for ${txId}: live record has no ${missing} (transient, will retry)`);
  }
}
