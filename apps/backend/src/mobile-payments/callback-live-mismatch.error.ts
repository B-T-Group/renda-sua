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
  | 'missing_live_currency'
  | 'live_currency_not_xof'
  | 'amount_mismatch'
  | 'missing_stored_reference'
  | 'missing_live_reference'
  | 'reference_mismatch';

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
