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
      condition_declined_at
      refund_status
      refund_provider
      refund_provider_ref
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
      customer_phone
      transaction_id
    }
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
    ) {
      id
      object_key
      created_at
    }
  }
`;

export const PENDING_REFUNDS = `
  query PendingDeclineRefunds {
    rental_bookings(
      where: {
        refund_status: { _eq: "refund_pending" }
        refund_provider_ref: { _is_null: false }
        condition_declined_at: { _is_null: false }
      }
      limit: 40
    ) {
      id
      booking_number
      refund_status
      refund_provider
      refund_provider_ref
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
