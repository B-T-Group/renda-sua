/**
 * Cooked meals sold by restaurants. Kept separate from the older
 * "Food & Beverages" category, which covers groceries and packaged goods.
 */
export const FOOD_CATEGORY_NAME = 'Restaurant & Cooked Food';

/** Default subcategory for AI-detected and merchant-flagged cooked dishes. */
export const FOOD_SUB_CATEGORY_NAME = 'Local Dishes';

/**
 * Cooked food does not track stock. Quantity stays at 1 so storefront
 * visibility filters that require available quantity above zero still pass.
 * Merchants take a dish off the menu with location is_active or sold-out-today.
 */
export const FOOD_DEFAULT_INVENTORY_QUANTITY = 1;

/** Hot food should not sit unconfirmed the way a retail order can. */
export const FOOD_ORDER_CONFIRMATION_TIMEOUT_MINUTES = 30;
