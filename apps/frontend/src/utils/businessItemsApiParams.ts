export function businessItemsApiParams(businessId?: string) {
  return businessId ? { params: { businessId } } : {};
}
