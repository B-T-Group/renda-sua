/** GraphQL documents for the admin catalog items browser. */

const ITEM_IMAGE_FIELDS = `
  id
  image_url
  rembg_image_url
  enhanced_image_url
  active_version
  display_order
  is_ai_cleaned
  is_rembg_cleaned
`;

export const ADMIN_CATALOG_ITEMS_LIST = `
  query AdminCatalogItemsList(
    $where: items_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    items(
      where: $where
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      name
      description
      sku
      price
      currency
      is_active
      moderation_status
      created_at
      updated_at
      business {
        id
        name
      }
      item_images(order_by: { display_order: asc }, limit: 1) {
        ${ITEM_IMAGE_FIELDS}
      }
    }
    items_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export const ADMIN_CATALOG_ITEM_BY_PK = `
  query AdminCatalogItemByPk($id: uuid!) {
    items_by_pk(id: $id) {
      id
      name
      description
      sku
      price
      currency
      is_active
      moderation_status
      status
      created_at
      updated_at
      weight
      weight_unit
      dimensions
      model
      color
      brand_id
      item_sub_category_id
      is_fragile
      is_perishable
      is_used
      requires_special_handling
      min_order_quantity
      max_order_quantity
      pay_on_delivery_enabled
      pay_at_pickup_enabled
      business {
        id
        name
      }
      brand {
        id
        name
      }
      item_sub_category {
        id
        name
        item_category {
          id
          name
        }
      }
      item_images(order_by: { display_order: asc }) {
        ${ITEM_IMAGE_FIELDS}
      }
    }
  }
`;
