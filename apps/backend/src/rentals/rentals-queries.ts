export const GET_LISTING_FOR_REQUEST = `
  query GetRentalListingForRequest($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      id
      is_active
      deleted_at
      moderation_status
      min_rental_hours
      max_rental_hours
      units_available
      base_price_per_hour
      base_price_per_day
      weekly_availability(order_by: { weekday: asc }) {
        weekday
        is_available
        start_time
        end_time
      }
      rental_item {
        id
        business_id
        currency
        is_active
        deleted_at
        business { id user_id is_verified }
      }
      business_location_id
    }
  }
`;

export const LIST_PUBLIC_RENTAL_LISTINGS = `
  query ListPublicRentalListings(
    $where: rental_location_listings_bool_exp!
    $order_by: [rental_location_listings_order_by!]!
  ) {
    rental_location_listings(where: $where, order_by: $order_by) {
      id
      base_price_per_hour
      base_price_per_day
      min_rental_hours
      max_rental_hours
      pickup_instructions
      dropoff_instructions
      updated_at
      weekly_availability(order_by: { weekday: asc }) {
        weekday
        is_available
        start_time
        end_time
      }
      rental_item {
        id
        name
        description
        tags
        currency
        operation_mode
        rental_category {
          id
          name
        }
        rental_item_images(order_by: { display_order: asc }) {
          id
          image_url
          alt_text
        }
        business {
          id
          name
          is_verified
        }
      }
      business_location {
        id
        name
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          latitude
          longitude
        }
      }
    }
  }
`;

export const GET_PUBLIC_RENTAL_LISTING_BY_PK = `
  query GetPublicRentalListingByPk($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      id
      deleted_at
      moderation_status
      base_price_per_hour
      base_price_per_day
      min_rental_hours
      max_rental_hours
      pickup_instructions
      dropoff_instructions
      updated_at
      weekly_availability(order_by: { weekday: asc }) {
        weekday
        is_available
        start_time
        end_time
      }
      rental_item {
        id
        name
        description
        tags
        currency
        operation_mode
        deleted_at
        rental_category {
          id
          name
        }
        rental_item_images(order_by: { display_order: asc }) {
          id
          image_url
          alt_text
        }
        business {
          id
          name
          is_verified
        }
      }
      business_location {
        id
        name
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          latitude
          longitude
        }
      }
    }
  }
`;

export const INSERT_RENTAL_REQUEST = `
  mutation InsertRentalRequest($object: rental_requests_insert_input!) {
    insert_rental_requests_one(object: $object) {
      id
      status
      requested_start_at
      requested_end_at
    }
  }
`;

export const GET_RENTAL_REQUEST_FULL = `
  query GetRentalRequestFull($id: uuid!) {
    rental_requests_by_pk(id: $id) {
      id
      client_id
      status
      requested_start_at
      requested_end_at
      rental_selection_windows
      rental_pricing_snapshot
      rental_location_listing_id
      expires_at
      rental_location_listing {
        id
        units_available
        base_price_per_hour
        base_price_per_day
        weekly_availability(order_by: { weekday: asc }) {
          weekday
          is_available
          start_time
          end_time
        }
        rental_item { id business_id currency is_active }
      }
      client { id user_id }
      rental_booking {
        id
        booking_number
        status
        contract_expires_at
      }
    }
  }
`;

/** One row per request (UNIQUE rental_request_id); explicit fetch avoids missing nested booking. */
export const GET_RENTAL_BOOKING_BY_RENTAL_REQUEST_ID = `
  query GetRentalBookingByRentalRequestId($rid: uuid!) {
    rental_bookings(where: { rental_request_id: { _eq: $rid } }, limit: 1) {
      id
      booking_number
      status
      contract_expires_at
    }
  }
`;

export const UPDATE_RENTAL_REQUEST_RESPOND = `
  mutation UpdateRentalRequestRespond(
    $id: uuid!
    $status: rental_request_status_enum!
    $snapshot: jsonb
    $note: String
    $unavailableReasonCode: String
    $requestExpiresAt: timestamptz
    $respondedAt: timestamptz!
    $userId: uuid!
  ) {
    update_rental_requests_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        rental_pricing_snapshot: $snapshot
        business_response_note: $note
        unavailable_reason_code: $unavailableReasonCode
        expires_at: $requestExpiresAt
        responded_at: $respondedAt
        responded_by_user_id: $userId
      }
    ) {
      id
      status
    }
  }
`;

export const LIST_TAKEN_RENTAL_BOOKING_WINDOWS = `
  query ListTakenRentalBookingWindows($listingId: uuid!) {
    rental_booking_windows(
      where: {
        rental_booking: {
          rental_location_listing_id: { _eq: $listingId }
          status: { _in: [confirmed, active, awaiting_return, proposed] }
        }
      }
      order_by: { start_at: asc }
    ) {
      start_at
      end_at
    }
  }
`;

export const COUNT_OVERLAPPING_BOOKINGS = `
  query CountOverlappingBookings(
    $listingId: uuid!
    $start: timestamptz!
    $end: timestamptz!
  ) {
    rental_bookings_aggregate(
      where: {
        rental_location_listing_id: { _eq: $listingId }
        status: { _in: [confirmed, active, awaiting_return] }
        rental_booking_windows: {
          _and: [
            { start_at: { _lt: $end } }
            { end_at: { _gt: $start } }
          ]
        }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

export const INSERT_RENTAL_BOOKING = `
  mutation InsertRentalBooking($object: rental_bookings_insert_input!) {
    insert_rental_bookings_one(object: $object) {
      id
      booking_number
      status
      total_amount
      currency
      start_at
      end_at
    }
  }
`;

export const INSERT_RENTAL_HOLD = `
  mutation InsertRentalHold($object: rental_holds_insert_input!) {
    insert_rental_holds_one(object: $object) {
      id
      rental_booking_id
      client_hold_amount
      status
    }
  }
`;

export const GET_RENTAL_BOOKING_FULL = `
  query GetRentalBookingFull($id: uuid!) {
    rental_bookings_by_pk(id: $id) {
      id
      booking_number
      rental_request_id
      client_id
      business_id
      rental_location_listing_id
      start_at
      end_at
      total_amount
      currency
      status
      rental_pricing_snapshot
      rental_start_pin_hash
      rental_start_pin_attempts
      rental_start_overwrite_code_hash
      rental_start_overwrite_code_used_at
      period_ended_notified_at
      client { id user_id }
      business { id user_id name }
      rental_location_listing {
        business_location_id
        rental_item { name }
      }
    }
  }
`;

export const GET_RENTAL_BOOKING_FULL_BY_BOOKING_NUMBER = `
  query GetRentalBookingFullByBookingNumber($bookingNumber: String!) {
    rental_bookings(
      where: { booking_number: { _eq: $bookingNumber } }
      limit: 1
    ) {
      id
      booking_number
      rental_request_id
      client_id
      business_id
      rental_location_listing_id
      start_at
      end_at
      total_amount
      currency
      status
      rental_pricing_snapshot
      rental_start_pin_hash
      rental_start_pin_attempts
      rental_start_overwrite_code_hash
      rental_start_overwrite_code_used_at
      period_ended_notified_at
      client { id user_id }
      business { id user_id name }
      rental_location_listing {
        business_location_id
        rental_item { name }
      }
    }
  }
`;

export const UPDATE_RENTAL_BOOKING_STATUS = `
  mutation UpdateRentalBookingStatus(
    $id: uuid!
    $status: rental_booking_status_enum!
    $actualStart: timestamptz
    $actualEnd: timestamptz
    $pinHash: String
    $overwriteHash: String
    $overwriteUsedAt: timestamptz
    $notifiedAt: timestamptz
  ) {
    update_rental_bookings_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        actual_start_at: $actualStart
        actual_end_at: $actualEnd
        rental_start_pin_hash: $pinHash
        rental_start_pin_attempts: 0
        rental_start_overwrite_code_hash: $overwriteHash
        rental_start_overwrite_code_used_at: $overwriteUsedAt
        period_ended_notified_at: $notifiedAt
      }
    ) {
      id
      status
    }
  }
`;

export const INCREMENT_RENTAL_PIN_ATTEMPTS = `
  mutation IncRentalPinAttempts($id: uuid!, $attempts: Int!) {
    update_rental_bookings_by_pk(
      pk_columns: { id: $id }
      _set: { rental_start_pin_attempts: $attempts }
    ) {
      id
      rental_start_pin_attempts
    }
  }
`;

export const UPDATE_RENTAL_HOLD_STATUS = `
  mutation UpdateRentalHoldStatus($bookingId: uuid!, $status: rental_hold_status_enum!) {
    update_rental_holds(
      where: { rental_booking_id: { _eq: $bookingId } }
      _set: { status: $status }
    ) {
      affected_rows
    }
  }
`;

export const INSERT_RENTAL_STATUS_HISTORY = `
  mutation InsertRentalStatusHistory($object: rental_status_history_insert_input!) {
    insert_rental_status_history_one(object: $object) {
      id
    }
  }
`;

export const UPDATE_RENTAL_REQUEST_STATUS = `
  mutation UpdateRentalRequestStatus($id: uuid!, $status: rental_request_status_enum!) {
    update_rental_requests_by_pk(pk_columns: { id: $id }, _set: { status: $status }) {
      id
      status
    }
  }
`;

export const LIST_ACTIVE_BOOKINGS_PAST_END = `
  query ListActiveBookingsPastEnd($now: timestamptz!) {
    rental_bookings(
      where: {
        status: { _eq: active }
        end_at: { _lte: $now }
        period_ended_notified_at: { _is_null: true }
      }
    ) {
      id
      end_at
      period_ended_notified_at
    }
  }
`;

export const GET_BUSINESS_RENTAL_ITEMS = `
  query GetBusinessRentalItems {
    rental_items(order_by: { updated_at: desc }) {
      id
      name
      description
      currency
      rental_category_id
      is_active
      deleted_at
      rental_item_images(order_by: { display_order: asc }) {
        id
        image_url
        display_order
      }
      rental_location_listings {
        id
        business_location_id
        base_price_per_hour
        base_price_per_day
        is_active
        deleted_at
        moderation_status
        moderated_at
      }
    }
  }
`;

export const GET_BUSINESS_RENTAL_ITEM_DETAIL = `
  query GetBusinessRentalItemDetail($id: uuid!) {
    rental_items_by_pk(id: $id) {
      id
      name
      description
      rental_category_id
      currency
      tags
      is_active
      deleted_at
      operation_mode
      rental_item_images(order_by: { display_order: asc }) {
        id
        image_url
        display_order
      }
      rental_location_listings(order_by: { created_at: desc }) {
        id
        business_location_id
        base_price_per_hour
        base_price_per_day
        min_rental_hours
        max_rental_hours
        units_available
        is_active
        deleted_at
        moderation_status
        moderated_at
        moderated_by_user_id
        pickup_instructions
        dropoff_instructions
        weekly_availability(order_by: { weekday: asc }) {
          id
          weekday
          is_available
          start_time
          end_time
        }
        business_location {
          id
          name
        }
      }
    }
  }
`;

export const UPDATE_BUSINESS_RENTAL_ITEM = `
  mutation UpdateBusinessRentalItem($id: uuid!, $_set: rental_items_set_input!) {
    update_rental_items_by_pk(pk_columns: { id: $id }, _set: $_set) {
      id
    }
  }
`;

export const UPDATE_BUSINESS_RENTAL_LISTING = `
  mutation UpdateBusinessRentalListing(
    $id: uuid!
    $_set: rental_location_listings_set_input!
  ) {
    update_rental_location_listings_by_pk(pk_columns: { id: $id }, _set: $_set) {
      id
    }
  }
`;

export const GET_RENTAL_LISTING_BUSINESS_CHECK = `
  query RentalListingBusinessCheck($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      id
      deleted_at
      moderation_status
      rental_item {
        business_id
        deleted_at
      }
    }
  }
`;

export const RESET_RENTAL_LISTING_MODERATION_PENDING = `
  mutation ResetRentalListingModerationPending($id: uuid!) {
    update_rental_location_listings_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: pending
        moderated_at: null
        moderated_by_user_id: null
      }
    ) {
      id
    }
  }
`;

export const GET_RENTAL_LISTING_MIN_MAX = `
  query GetRentalListingMinMax($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      min_rental_hours
      max_rental_hours
    }
  }
`;

export const GET_CLIENT_RENTAL_REQUESTS = `
  query GetClientRentalRequests {
    rental_requests(order_by: { created_at: desc }, limit: 30) {
      id
      status
      requested_start_at
      requested_end_at
      created_at
      business_response_note
      client_request_note
      unavailable_reason_code
      rental_pricing_snapshot
      responded_at
      expires_at
      rental_location_listing {
        id
        base_price_per_hour
        base_price_per_day
        business_location {
          name
        }
        rental_item {
          name
          currency
        }
      }
      rental_booking {
        id
        status
        contract_expires_at
      }
    }
  }
`;

export const GET_BUSINESS_RENTAL_REQUESTS = `
  query GetBusinessRentalRequests {
    rental_requests(order_by: { created_at: desc }, limit: 50) {
      id
      created_at
      status
      requested_start_at
      requested_end_at
      rental_selection_windows
      rental_pricing_snapshot
      business_response_note
      client_request_note
      unavailable_reason_code
      expires_at
      responded_at
      client {
        id
        user {
          first_name
          last_name
          email
          phone_number
        }
      }
      rental_location_listing {
        id
        base_price_per_hour
        base_price_per_day
        weekly_availability(order_by: { weekday: asc }) {
          weekday
          is_available
          start_time
          end_time
        }
        rental_item {
          name
          currency
        }
      }
    }
  }
`;

export const GET_BUSINESS_RENTAL_SCHEDULE = `
  query GetBusinessRentalSchedule($rentalItemId: uuid) {
    rental_bookings(
      where: {
        status: { _in: [proposed, confirmed, active, awaiting_return] }
        rental_location_listing: {
          rental_item_id: { _eq: $rentalItemId }
        }
      }
      order_by: { start_at: asc }
      limit: 500
    ) {
      id
      status
      start_at
      end_at
      total_amount
      currency
      rental_location_listing {
        id
        business_location {
          id
          name
        }
        rental_item {
          id
          name
        }
      }
      rental_request {
        id
        created_at
        client {
          id
          user {
            first_name
            last_name
            phone_number
            email
          }
        }
      }
    }
  }
`;

export const COUNT_ACTIVE_PROPOSED_BOOKINGS_FOR_LISTING = `
  query CountActiveProposedBookingsForListing($listingId: uuid!, $now: timestamptz!) {
    rental_bookings_aggregate(
      where: {
        rental_location_listing_id: { _eq: $listingId }
        status: { _eq: proposed }
        contract_expires_at: { _gt: $now }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

export const LIST_EXPIRED_PROPOSED_RENTAL_BOOKINGS = `
  query ListExpiredProposedRentalBookings($now: timestamptz!) {
    rental_bookings(
      where: {
        status: { _eq: proposed }
        contract_expires_at: { _lte: $now }
      }
    ) {
      id
      rental_request_id
    }
  }
`;

export const INSERT_BUSINESS_RENTAL_ITEM = `
  mutation InsertBusinessRentalItem($object: rental_items_insert_input!) {
    insert_rental_items_one(object: $object) {
      id
    }
  }
`;

export const INSERT_BUSINESS_RENTAL_LISTING = `
  mutation InsertBusinessRentalListing($object: rental_location_listings_insert_input!) {
    insert_rental_location_listings_one(object: $object) {
      id
    }
  }
`;

export const UPSERT_RENTAL_LISTING_WEEKLY_AVAILABILITY = `
  mutation UpsertRentalListingWeeklyAvailability($objects: [rental_listing_weekly_availability_insert_input!]!) {
    insert_rental_listing_weekly_availability(
      objects: $objects
      on_conflict: {
        constraint: rental_listing_weekly_availability_unique
        update_columns: [is_available, start_time, end_time, updated_at]
      }
    ) {
      affected_rows
    }
  }
`;

export const GET_RENTAL_ITEM_BUSINESS_CHECK = `
  query RentalItemBusinessCheck($id: uuid!) {
    rental_items_by_pk(id: $id) {
      id
      business_id
      deleted_at
    }
  }
`;

export const COUNT_IN_FLIGHT_RENTAL_BOOKINGS_FOR_LISTING = `
  query CountInFlightBookingsForListing($listingId: uuid!) {
    rental_bookings_aggregate(
      where: {
        rental_location_listing_id: { _eq: $listingId }
        status: { _in: [proposed, confirmed, active, awaiting_return] }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

export const COUNT_OPEN_RENTAL_REQUESTS_FOR_LISTING = `
  query CountOpenRentalRequestsForListing($listingId: uuid!) {
    rental_requests_aggregate(
      where: {
        rental_location_listing_id: { _eq: $listingId }
        status: { _in: [pending, available] }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

export const COUNT_IN_FLIGHT_RENTAL_BOOKINGS_FOR_RENTAL_ITEM = `
  query CountInFlightBookingsForRentalItem($rentalItemId: uuid!) {
    rental_bookings_aggregate(
      where: {
        rental_location_listing: { rental_item_id: { _eq: $rentalItemId } }
        status: { _in: [proposed, confirmed, active, awaiting_return] }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

export const COUNT_OPEN_RENTAL_REQUESTS_FOR_RENTAL_ITEM = `
  query CountOpenRentalRequestsForRentalItem($rentalItemId: uuid!) {
    rental_requests_aggregate(
      where: {
        rental_location_listing: { rental_item_id: { _eq: $rentalItemId } }
        status: { _in: [pending, available] }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

export const SOFT_DELETE_RENTAL_LOCATION_LISTING = `
  mutation SoftDeleteRentalLocationListing($id: uuid!, $deletedAt: timestamptz!) {
    update_rental_location_listings_by_pk(
      pk_columns: { id: $id }
      _set: { deleted_at: $deletedAt, is_active: false }
    ) {
      id
    }
  }
`;

export const SOFT_DELETE_RENTAL_LISTINGS_FOR_ITEM = `
  mutation SoftDeleteRentalListingsForItem($rentalItemId: uuid!, $deletedAt: timestamptz!) {
    update_rental_location_listings(
      where: {
        rental_item_id: { _eq: $rentalItemId }
        deleted_at: { _is_null: true }
      }
      _set: { deleted_at: $deletedAt, is_active: false }
    ) {
      affected_rows
    }
  }
`;

export const SOFT_DELETE_RENTAL_ITEM = `
  mutation SoftDeleteRentalItem($id: uuid!, $deletedAt: timestamptz!) {
    update_rental_items_by_pk(
      pk_columns: { id: $id }
      _set: { deleted_at: $deletedAt, is_active: false }
    ) {
      id
    }
  }
`;

export const GET_BUSINESS_LOCATION_OWNER = `
  query BusinessLocationOwner($id: uuid!) {
    business_locations_by_pk(id: $id) {
      id
      business_id
    }
  }
`;
