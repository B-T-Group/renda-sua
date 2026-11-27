export const COMMISSION_RULES_FOR_CONTEXT = `
  query RentalCommissionRules($businessId: uuid!, $categoryId: uuid) {
    rental_commission_rules(
      where: {
        status: { _eq: "active" }
        _or: [
          { scope: { _in: ["default", "country"] } }
          { scope: { _eq: "category" }, rental_category_id: { _eq: $categoryId } }
          { scope: { _in: ["merchant", "promo"] }, business_id: { _eq: $businessId } }
        ]
      }
    ) {
      id scope business_id rental_category_id country_code campaign_code rate_bps
      effective_from effective_to status
    }
  }
`;

export const COMMISSION_CONFIG_ROWS = `
  query RentalCommissionConfig($keys: [String!]!, $country: String!) {
    application_configurations(
      where: {
        config_key: { _in: $keys }
        status: { _eq: "active" }
        _or: [{ country_code: { _eq: $country } }, { country_code: { _is_null: true } }]
      }
    ) {
      config_key country_code boolean_value number_value date_value
    }
  }
`;

export const INSERT_COMMISSION_RULE = `
  mutation InsertRentalCommissionRule($object: rental_commission_rules_insert_input!) {
    insert_rental_commission_rules_one(object: $object) {
      id scope business_id rental_category_id country_code campaign_code rate_bps
      effective_from effective_to status reason created_by created_at
    }
  }
`;

export const END_COMMISSION_RULE = `
  mutation EndRentalCommissionRule($id: uuid!, $at: timestamptz!) {
    update_rental_commission_rules(
      where: { id: { _eq: $id }, status: { _eq: "active" } }
      _set: { status: "ended", effective_to: $at }
    ) {
      returning { id scope business_id rental_category_id country_code campaign_code rate_bps effective_from effective_to status }
    }
  }
`;

export const END_OPEN_COMMISSION_RULES = `
  mutation EndOpenRentalCommissionRules($where: rental_commission_rules_bool_exp!, $at: timestamptz!) {
    update_rental_commission_rules(
      where: $where
      _set: { status: "ended", effective_to: $at }
    ) {
      affected_rows
    }
  }
`;

export const LIST_COMMISSION_RULES = `
  query ListRentalCommissionRules($where: rental_commission_rules_bool_exp!) {
    rental_commission_rules(where: $where, order_by: { created_at: desc }, limit: 200) {
      id scope business_id rental_category_id country_code campaign_code rate_bps
      effective_from effective_to status reason created_by created_at
    }
  }
`;

export const COMMISSION_REQUEST_CONTEXT = `
  query RentalCommissionRequestContext($id: uuid!) {
    rental_requests_by_pk(id: $id) {
      id
      status
      quoted_total
      rental_pricing_snapshot
      rental_location_listing {
        rental_item { business_id currency rental_category_id }
        business_location { address { country } }
      }
    }
  }
`;

export const FREEZE_BOOKING_COMMISSION = `
  mutation FreezeRentalCommission($id: uuid!, $set: rental_bookings_set_input!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, commission_status: { _in: ["not_applicable", "quoted"] } }
      _set: $set
    ) { affected_rows }
  }
`;

export const SET_BOOKING_COMMISSION_STATUS = `
  mutation SetRentalCommissionStatus($id: uuid!, $from: [String!]!, $set: rental_bookings_set_input!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, commission_status: { _in: $from } }
      _set: $set
    ) { affected_rows }
  }
`;

export const INSERT_RENTAL_COMMISSION_PAYOUT = `
  mutation InsertRentalCommissionPayout($object: commission_payouts_insert_input!) {
    insert_commission_payouts_one(
      object: $object
      on_conflict: { constraint: commission_payouts_rental_booking_type_key, update_columns: [] }
    ) { id }
  }
`;

export const BUSINESS_COMMISSION_SUMMARY = `
  query BusinessRentalCommissionSummary($businessId: uuid!) {
    rental_bookings(
      where: { business_id: { _eq: $businessId }, commission_status: { _in: ["quoted", "earned"] } }
      order_by: { created_at: desc }
      limit: 500
    ) {
      id booking_number currency status commission_status commission_rate_bps commission_base_amount
      commission_amount merchant_payout_amount commission_earned_at commission_campaign_code
    }
  }
`;

export const COMMISSION_REPORT = `
  query RentalCommissionReport($where: rental_bookings_bool_exp!) {
    rental_bookings(where: $where, order_by: { created_at: desc }, limit: 1000) {
      id booking_number business_id currency status commission_status commission_rate_bps
      commission_base_amount commission_amount merchant_payout_amount commission_earned_amount commission_earned_at
      commission_source commission_campaign_code
    }
  }
`;

