/**
 * Hasura field names for catalog-stop location scoping.
 * Country/state live on `addresses`, not `business_locations`.
 * Storefront visibility lives on `businesses.is_storefront_visible`.
 */

export function visibleStoreLocationWhere(
  countryCode?: string,
  state?: string
): Record<string, unknown> {
  const address: Record<string, unknown> = {};
  if (countryCode?.trim()) {
    address.country = { _eq: countryCode.trim() };
  }
  if (state?.trim()) {
    address.state = { _eq: state.trim() };
  }
  return {
    is_active: { _eq: true },
    business: { is_storefront_visible: { _eq: true } },
    ...(Object.keys(address).length > 0 ? { address } : {}),
  };
}

export const STOP_INVENTORY_SELECTION = `
  id
  selling_price
  computed_available_quantity
  is_active
  business_location_id
  item_id
  promotion
  variant_price_overrides {
    id
    item_variant_id
    selling_price
  }
  item {
    id
    name
    description
    price
    currency
    weight
    weight_unit
    dimensions
    item_sub_category_id
    is_active
    sku
    brand { id name }
    item_sub_category {
      id
      name
      item_category { id name }
    }
    item_images(order_by: { created_at: asc }, limit: 5) {
      id
      image_url
    }
    item_variants(
      where: { is_active: { _eq: true } }
      order_by: { sort_order: asc }
    ) {
      id
      name
      sku
      price
      is_default
    }
  }
  business_location {
    id
    name
    business { id name }
    address { city country state }
  }
`;

export const GET_TOP_IN_CATEGORY = `
  query GetTopInCategory(
    $itemWhere: items_bool_exp!
    $locationWhere: business_locations_bool_exp!
    $limit: Int!
  ) {
    business_inventory(
      where: {
        is_active: { _eq: true }
        computed_available_quantity: { _gt: 0 }
        item: $itemWhere
        business_location: $locationWhere
      }
      limit: $limit
    ) {
      ${STOP_INVENTORY_SELECTION}
    }
  }
`;

export const GET_ACTIVE_DEALS = `
  query GetActiveDeals(
    $now: timestamptz!
    $locationWhere: business_locations_bool_exp!
    $limit: Int!
  ) {
    item_deals(
      where: {
        is_active: { _eq: true }
        start_at: { _lte: $now }
        end_at: { _gte: $now }
        business_inventory: {
          is_active: { _eq: true }
          computed_available_quantity: { _gt: 0 }
          item: { is_active: { _eq: true } }
          business_location: $locationWhere
        }
      }
      limit: $limit
      order_by: { start_at: desc }
    ) {
      id
      discount_type
      discount_value
      start_at
      end_at
      business_inventory {
        ${STOP_INVENTORY_SELECTION}
      }
    }
  }
`;

export const GET_FEATURED_STORES = `
  query GetFeaturedStores(
    $where: business_locations_bool_exp!
    $limit: Int!
  ) {
    business_locations(
      where: $where
      limit: $limit
      order_by: { created_at: desc }
    ) {
      id
      name
      logo_url
      business {
        id
        name
        is_verified
        can_accept_orders
        is_storefront_visible
      }
      address { city }
      business_inventory_aggregate(
        where: {
          is_active: { _eq: true }
          computed_available_quantity: { _gt: 0 }
        }
      ) {
        aggregate { count }
      }
    }
  }
`;

export const GET_COMPLEMENT_ITEMS = `
  query GetComplementItems(
    $categoryIds: [Int!]!
    $excludeIds: [uuid!]!
    $locationWhere: business_locations_bool_exp!
    $limit: Int!
  ) {
    business_inventory(
      where: {
        is_active: { _eq: true }
        computed_available_quantity: { _gt: 0 }
        id: { _nin: $excludeIds }
        item: {
          is_active: { _eq: true }
          item_sub_category: { item_category_id: { _in: $categoryIds } }
        }
        business_location: $locationWhere
      }
      limit: $limit
    ) {
      ${STOP_INVENTORY_SELECTION}
    }
  }
`;
