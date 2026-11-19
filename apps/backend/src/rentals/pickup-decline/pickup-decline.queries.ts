export const DECLINE_BOOKING = `
  query DeclineBooking($id: uuid!) {
    rental_bookings_by_pk(id: $id) {
      id
      booking_number
      status
      payment_status
      contract_expires_at
      actual_start_at
      inspection_policy_version
      pickup_current_version_id
      pickup_accepted_version_id
      condition_declined_at
      refund_status
      refund_attempts
      refund_next_at
      refund_amount
      refund_provider
      refund_provider_ref
      refund_sent_at
      refund_send_attempted_at
      refund_list_empty_at
      refund_unknown_streak
      refund_unknown_notice_at
      refund_requested_at
      refund_claim_at
      refund_credited_at
      authorized_amount
      total_amount
      currency
      client_id
      business_id
      client { id user_id user { first_name last_name } }
      business { id user_id }
      rental_location_listing {
        business_location { address { country } }
        rental_item { id name inspection_opt_in }
      }
    }
  }
`;

export const FIND_DECLINE = `
  query FindConditionDecline($bookingId: uuid!, $versionId: uuid!) {
    rental_condition_declines(
      where: { rental_booking_id: { _eq: $bookingId }, version_id: { _eq: $versionId } }
      limit: 1
    ) {
      id
      rental_booking_id
      version_id
      reason
      reason_text
      money_rail
      money_amount
      money_currency
      phone_mask
      effects_recorded_at
      created_at
    }
  }
`;

export const FIND_DECLINE_FOR_BOOKING = `
  query FindDeclineForBooking($bookingId: uuid!) {
    rental_condition_declines(
      where: { rental_booking_id: { _eq: $bookingId } }
      order_by: { created_at: desc }
      limit: 1
    ) {
      id
      version_id
      reason
      reason_text
      money_rail
      money_amount
      money_currency
      phone_mask
      effects_recorded_at
      created_at
    }
  }
`;

export const INSERT_DECLINE = `
  mutation InsertConditionDecline($object: rental_condition_declines_insert_input!) {
    insert_rental_condition_declines_one(object: $object) { id }
  }
`;

export const DECLINE_COLLECTS = `
  query DeclineCollects($bookingNumber: String!) {
    mobile_payment_transactions(
      where: {
        payment_entity: { _eq: rental_booking }
        status: { _eq: "success" }
        entity_id: { _eq: $bookingNumber }
      }
      order_by: { created_at: asc }
    ) {
      amount
      currency
      provider
      payment_method
      customer_phone
      transaction_id
    }
  }
`;

export const CANCEL_PENDING_COLLECTS = `
  mutation CancelPendingDeclineCollects($bookingNumber: String!) {
    update_mobile_payment_transactions(
      where: {
        payment_entity: { _eq: rental_booking }
        entity_id: { _eq: $bookingNumber }
        status: { _in: ["pending", "processing"] }
      }
      _set: { status: "cancelled", error_code: "SUPERSEDED_BY_DECLINE" }
    ) { affected_rows }
  }
`;

export const DECLINE_CANCEL = `
  mutation DeclineCancelBooking(
    $id: uuid!
    $from: [rental_booking_status_enum!]!
    $versionId: uuid!
    $set: rental_bookings_set_input!
  ) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        status: { _in: $from }
        pickup_current_version_id: { _eq: $versionId }
        actual_start_at: { _is_null: true }
      }
      _set: $set
    ) { affected_rows }
  }
`;

export const DECLINE_HOLD = `
  query DeclineHold($bookingId: uuid!) {
    rental_holds(where: { rental_booking_id: { _eq: $bookingId } }) {
      client_hold_amount
      status
    }
  }
`;

export const STAMP_REFUND = `
  mutation StampDeclineRefund($id: uuid!, $set: rental_bookings_set_input!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, status: { _eq: cancelled }, refund_status: { _eq: "none" } }
      _set: $set
    ) { affected_rows }
  }
`;

export const CLAIM_REFUND = `
  mutation ClaimDeclineRefund(
    $id: uuid!
    $attempts: Int!
    $stale: timestamptz!
    $set: rental_bookings_set_input!
  ) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_status: { _eq: "refund_pending" }
        refund_attempts: { _eq: $attempts }
        _or: [
          { refund_claim_at: { _is_null: true } }
          { refund_claim_at: { _lt: $stale } }
        ]
      }
      _set: $set
    ) { affected_rows }
  }
`;

export const DELETE_DECLINE = `
  mutation DeleteConditionDecline($id: uuid!) {
    delete_rental_condition_declines_by_pk(id: $id) { id }
  }
`;

export const CLAIM_EFFECTS = `
  mutation ClaimDeclineEffects($id: uuid!, $at: timestamptz!) {
    update_rental_condition_declines(
      where: { id: { _eq: $id }, effects_recorded_at: { _is_null: true } }
      _set: { effects_recorded_at: $at }
    ) { affected_rows }
  }
`;

export const CLEAR_EFFECTS = `
  mutation ClearDeclineEffects($id: uuid!) {
    update_rental_condition_declines_by_pk(
      pk_columns: { id: $id }
      _set: { effects_recorded_at: null }
    ) { id }
  }
`;

export const DECLINE_HISTORY = `
  query DeclineHistoryNote($bookingId: uuid!, $notes: String!) {
    rental_status_history(
      where: { rental_booking_id: { _eq: $bookingId }, notes: { _eq: $notes } }
      limit: 1
    ) { id }
  }
`;

export const STAMP_SENT = `
  mutation StampDeclineRefundSent($id: uuid!, $token: uuid!, $provider: String!, $ref: String!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_status: { _eq: "refund_pending" }
        refund_claim_token: { _eq: $token }
        refund_sent_at: { _is_null: true }
        _or: [
          { refund_provider_ref: { _is_null: true } }
          { refund_provider_ref: { _eq: $ref } }
        ]
      }
      _set: { refund_sent_at: $at, refund_provider: $provider, refund_provider_ref: $ref }
    ) { affected_rows }
  }
`;

export const KEEP_PROVIDER_REF = `
  mutation KeepDeclineProviderRef($id: uuid!, $stableRef: String!, $ref: String!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, refund_provider_ref: { _eq: $stableRef } }
      _set: { refund_provider_ref: $ref }
    ) { affected_rows }
  }
`;

export const CLAIM_NOTICE = `
  mutation NoteDeclineRefundOnce($id: uuid!, $outcome: jsonb!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        _not: { refund_notices: { _contains: $outcome } }
      }
      _append: { refund_notices: $outcome }
    ) { affected_rows }
  }
`;

export const RELEASE_NOTICE = `
  mutation ReleaseDeclineRefundNotice($id: uuid!, $outcome: String!) {
    update_rental_bookings(
      where: { id: { _eq: $id } }
      _delete_key: { refund_notices: $outcome }
    ) { affected_rows }
  }
`;

export const CLEAR_STABLE_REF = `
  mutation ClearDeclineStableRef($id: uuid!, $token: uuid!, $stableRef: String!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_provider_ref: { _eq: $stableRef }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_provider_ref: null }
    ) { affected_rows }
  }
`;

export const RESTORE_REFUND_ATTEMPT = `
  mutation RestoreDeclineRefundAttempt($id: uuid!, $token: uuid!, $attempts: Int!, $next: timestamptz!, $streak: Int!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_attempts: $attempts, refund_next_at: $next, refund_unknown_streak: $streak }
    ) { affected_rows }
  }
`;

export const STAMP_LIST_EMPTY = `
  mutation StampDeclineListEmpty($id: uuid!, $token: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
        refund_list_empty_at: { _is_null: true }
      }
      _set: { refund_list_empty_at: $at }
    ) { affected_rows }
  }
`;

export const CLEAR_LIST_EMPTY = `
  mutation ClearDeclineListEmpty($id: uuid!, $token: uuid!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_list_empty_at: null }
    ) { affected_rows }
  }
`;

export const STAMP_UNKNOWN_NOTICE = `
  mutation StampDeclineUnknownNotice($id: uuid!, $token: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_unknown_notice_at: $at }
    ) { affected_rows }
  }
`;

export const SCHEDULE_REFUND_POLL = `
  mutation ScheduleDeclineRefundPoll($id: uuid!, $token: uuid!, $next: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_next_at: $next, refund_unknown_streak: 0 }
    ) { affected_rows }
  }
`;

export const FEDAPAY_REFUND_CONFIG = `
  query FedapayRefundConfig($key: String!) {
    application_configurations(
      where: { config_key: { _eq: $key }, status: { _eq: "active" }, country_code: { _is_null: true } }
      order_by: [{ updated_at: desc }, { created_at: desc }, { id: desc }]
      limit: 1
    ) { number_value }
  }
`;

export const BUMP_SEND_ATTEMPT = `
  mutation BumpDeclineSendAttempt($id: uuid!, $token: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_status: { _eq: "refund_pending" }
        refund_claim_token: { _eq: $token }
      }
      _set: { refund_send_attempted_at: $at }
    ) { affected_rows }
  }
`;

export const STAMP_ATTEMPT = `
  mutation StampDeclineSendAttempt($id: uuid!, $token: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_status: { _eq: "refund_pending" }
        refund_claim_token: { _eq: $token }
        refund_send_attempted_at: { _is_null: true }
      }
      _set: { refund_send_attempted_at: $at }
    ) { affected_rows }
  }
`;

export const CLEAR_ATTEMPT = `
  mutation ClearDeclineSendAttempt($id: uuid!, $token: uuid!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_send_attempted_at: null }
    ) { affected_rows }
  }
`;

export const REFUND_ACCOUNT = `
  query DeclineRefundAccount($userId: uuid!, $currency: currency_enum!) {
    accounts(where: { user_id: { _eq: $userId }, currency: { _eq: $currency } }, limit: 1) { id }
  }
`;

export const CLOSE_DECLINE_REFUND = `
  mutation CloseDeclineRefund(
    $id: uuid!
    $token: uuid!
    $status: String!
    $provider: String!
    $providerRef: String
    $accountId: uuid
    $amount: numeric!
    $memo: String
    $idempotencyKey: String!
    $changedBy: uuid!
    $notes: String!
    $previousStatus: String!
  ) {
    close_decline_refund(args: {
      p_booking_id: $id
      p_token: $token
      p_status: $status
      p_provider: $provider
      p_provider_ref: $providerRef
      p_account_id: $accountId
      p_amount: $amount
      p_memo: $memo
      p_idempotency_key: $idempotencyKey
      p_changed_by: $changedBy
      p_notes: $notes
      p_previous_status: $previousStatus
    }) { id }
  }
`;

export const CLEAR_SENT = `
  mutation ClearDeclineRefundSent($id: uuid!, $token: uuid!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_claim_token: { _eq: $token }
        refund_status: { _eq: "refund_pending" }
      }
      _set: { refund_sent_at: null }
    ) { affected_rows }
  }
`;

export const MARK_CREDITED = `
  mutation MarkDeclineWalletCredit($id: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, refund_credited_at: { _is_null: true } }
      _set: { refund_credited_at: $at }
    ) { affected_rows }
  }
`;

/** Hasura _append exists only on jsonb. A text[] document is the error CI used to miss. */
export function noticeMutationShape(document: string): void {
  const jsonb = document.includes('$outcome: jsonb!');
  const contains = document.includes('_contains: $outcome');
  const append = document.includes('_append: { refund_notices: $outcome }');
  if (!jsonb || !contains || !append) {
    throw new Error("field 'refund_notices' not found in type: 'rental_bookings_append_input'");
  }
}

export const KEEP_REFUND_CLAIM = `
  mutation KeepDeclineRefundClaim($id: uuid!, $token: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_status: { _eq: "refund_pending" }
        refund_claim_token: { _eq: $token }
      }
      _set: { refund_claim_at: $at }
    ) { affected_rows }
  }
`;

export const APPLY_OWNED_REFUND = `
  mutation ApplyOwnedDeclineRefund($id: uuid!, $token: uuid!, $set: rental_bookings_set_input!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        refund_status: { _eq: "refund_pending" }
        refund_claim_token: { _eq: $token }
      }
      _set: $set
    ) { affected_rows }
  }
`;

export const APPLY_REFUND_POLL = `
  mutation ApplyDeclineRefundPoll($id: uuid!, $set: rental_bookings_set_input!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, refund_status: { _eq: "refund_pending" } }
      _set: $set
    ) { affected_rows }
  }
`;

export const READY_PHOTOS = `
  query DeclineReadyPhotos($ids: [uuid!]!, $bookingId: uuid!) {
    rental_condition_decline_photos(
      where: { id: { _in: $ids }, rental_booking_id: { _eq: $bookingId } }
    ) {
      id
      object_key
      status
      decline_id
    }
  }
`;

export const LINK_PHOTOS = `
  mutation LinkDeclinePhotos($ids: [uuid!]!, $bookingId: uuid!, $declineId: uuid!) {
    update_rental_condition_decline_photos(
      where: {
        id: { _in: $ids }
        rental_booking_id: { _eq: $bookingId }
        decline_id: { _is_null: true }
        status: { _eq: "ready" }
      }
      _set: { decline_id: $declineId }
    ) { affected_rows }
  }
`;

export const DECLINE_PHOTO_ROWS = `
  query DeclinePhotoRows($declineId: uuid!) {
    rental_condition_decline_photos(
      where: { decline_id: { _eq: $declineId }, status: { _eq: "ready" } }
      order_by: { created_at: asc }
    ) {
      id
      object_key
      created_at
    }
  }
`;

export const RENTER_NOTICE_RETRIES = `
  query DeclineRenterNoticeRetries($landed: jsonb!, $try1: jsonb!, $try2: jsonb!, $try3: jsonb!) {
    rental_bookings(
      where: {
        _and: [
          { refund_status: { _in: ["failed", "manual", "refunded"] } }
          { _not: { refund_notices: { _contains: $landed } } }
          { _not: { refund_notices: { _contains: $try3 } } }
          {
            _or: [
              { refund_notices: { _contains: $try1 } }
              { refund_notices: { _contains: $try2 } }
            ]
          }
        ]
      }
      order_by: { refund_status_at: asc }
      limit: 20
    ) {
      id
      booking_number
      status
      currency
      refund_status
      refund_amount
      refund_provider
      refund_provider_ref
      refund_credited_at
      refund_notices
      client { user_id }
      business { user_id }
      rental_location_listing { rental_item { name } }
    }
  }
`;

export const PENDING_REFUNDS = `
  query PendingDeclineRefunds($now: timestamptz!, $stale: timestamptz!) {
    rental_bookings(
      where: {
        refund_status: { _eq: "refund_pending" }
        condition_declined_at: { _is_null: false }
        _and: [
          { _or: [
            { refund_next_at: { _is_null: true } }
            { refund_next_at: { _lte: $now } }
          ] }
          { _or: [
            { refund_claim_at: { _is_null: true } }
            { refund_claim_at: { _lt: $stale } }
          ] }
        ]
      }
      limit: 40
    ) {
      id
      booking_number
      status
      currency
      business_id
      refund_status
      refund_attempts
      refund_amount
      refund_provider
      refund_provider_ref
      refund_sent_at
      refund_send_attempted_at
      refund_list_empty_at
      refund_unknown_streak
      refund_unknown_notice_at
      refund_claim_at
      client { user_id }
      business { user_id }
      rental_location_listing { rental_item { name } }
    }
  }
`;

export const COUNTS_90 = `
  query ConditionDeclineCounts90 {
    rental_condition_decline_counts_90d(order_by: { decline_count: desc }) {
      id
      role
      party_id
      decline_count
      last_decline_at
    }
    rental_business_pickup_reach_90d {
      business_id
      pickups_reached
    }
  }
`;

export const PARTY_NAMES = `
  query DeclinePartyNames($clients: [uuid!]!, $businesses: [uuid!]!) {
    clients(where: { id: { _in: $clients } }) {
      id
      user { first_name last_name }
    }
    businesses(where: { id: { _in: $businesses } }) { id name }
  }
`;

export const BUSINESS_DECLINE_STAT = `
  query BusinessDeclineStat($id: uuid!) {
    rental_condition_decline_counts_90d(
      where: { role: { _eq: "business" }, party_id: { _eq: $id } }
      limit: 1
    ) { decline_count }
    rental_business_pickup_reach_90d(where: { business_id: { _eq: $id } }, limit: 1) {
      pickups_reached
    }
  }
`;

export const ITEM_OPT_IN = `
  query DeclineItemOptIn($id: uuid!) {
    rental_items_by_pk(id: $id) { id inspection_opt_in }
  }
`;

export const BASELINE_PHOTOS = `
  query PublicBaselinePhotos($itemId: uuid!) {
    rental_item_baseline_photos(
      where: { rental_item_id: { _eq: $itemId }, status: { _eq: "ready" } }
      order_by: { slot_key: asc }
    ) {
      id
      slot_key
      object_key
      captured_at
      status
    }
  }
`;

export const INSERT_PENDING_PHOTO = `
  mutation InsertDeclinePhoto($object: rental_condition_decline_photos_insert_input!) {
    insert_rental_condition_decline_photos_one(object: $object) { id }
  }
`;

export const PHOTO_COUNT = `
  query DeclinePhotoCount($bookingId: uuid!) {
    rental_condition_decline_photos_aggregate(
      where: { rental_booking_id: { _eq: $bookingId } }
    ) { aggregate { count } }
  }
`;

export const PHOTO_BY_ID = `
  query DeclinePhotoById($id: uuid!, $bookingId: uuid!) {
    rental_condition_decline_photos(
      where: { id: { _eq: $id }, rental_booking_id: { _eq: $bookingId } }
      limit: 1
    ) {
      id
      object_key
      status
      content_type
      expected_byte_size
    }
  }
`;

export const MARK_PHOTO_READY = `
  mutation MarkDeclinePhotoReady($id: uuid!, $key: String!, $bytes: Int!) {
    update_rental_condition_decline_photos_by_pk(
      pk_columns: { id: $id }
      _set: { object_key: $key, status: "ready", byte_size: $bytes, content_type: "image/jpeg" }
    ) { id }
  }
`;
