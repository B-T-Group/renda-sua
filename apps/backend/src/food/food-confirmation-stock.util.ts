export interface FoodConfirmationStockUpdate {
  order_item_id: string;
  /**
   * Ignored for cooked food (stock is not tracked). Kept optional so older
   * clients that still send it do not break confirmation.
   */
  remaining_quantity?: number;
  /** Takes the dish off the menu for the rest of the day. */
  last_one?: boolean;
}
