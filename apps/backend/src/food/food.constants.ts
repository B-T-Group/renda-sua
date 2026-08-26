/**
 * Cooked meals sold by restaurants. Kept separate from the older
 * "Food & Beverages" category, which covers groceries and packaged goods.
 */
export const FOOD_CATEGORY_NAME = 'Restaurant & Cooked Food';

/**
 * Restaurants cook to order rather than counting stock, so food inventory is
 * seeded with a high quantity. Storefront visibility requires available
 * quantity above zero, and the sold-out toggle is what takes a dish off the
 * menu for the day.
 */
export const FOOD_DEFAULT_INVENTORY_QUANTITY = 9999;

/** Hot food should not sit unconfirmed the way a retail order can. */
export const FOOD_ORDER_CONFIRMATION_TIMEOUT_MINUTES = 30;
