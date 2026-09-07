export interface CatalogFilterState {
  category: string;
  subcategory: string;
  brand: string;
  /** Business (seller) display name — matches Nest `business_name` on GET /inventory-items */
  business: string;
  /** Platform collection slug */
  collection: string;
}
