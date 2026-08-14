/** Already-authorized business actor for owner-facing order methods. */
export interface AuthorizedBusinessActor {
  userId: string;
  businessId: string;
  locationId: string;
}
