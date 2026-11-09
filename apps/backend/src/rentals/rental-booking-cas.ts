import { CAS_UPDATE_RENTAL_BOOKING } from './rentals-queries';

export interface RentalCasClient {
  executeMutation<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

/** One status write. Returns false when the row is no longer in `from`. */
export async function casUpdateRentalBooking(
  hasura: RentalCasClient,
  id: string,
  from: string[],
  set: Record<string, unknown>
): Promise<boolean> {
  const result = await hasura.executeMutation<{
    update_rental_bookings: { affected_rows: number } | null;
  }>(CAS_UPDATE_RENTAL_BOOKING, { id, from, set });
  return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
}
