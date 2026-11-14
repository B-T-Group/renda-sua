let pending: { listingId: string; startDate?: string; endDate?: string } | null = null;

export function rememberPendingRentalRequest(value: {
  listingId: string;
  startDate?: string;
  endDate?: string;
}): void {
  pending = value;
}

export function takePendingRentalRequest(): {
  listingId: string;
  startDate?: string;
  endDate?: string;
} | null {
  const value = pending;
  pending = null;
  return value;
}
