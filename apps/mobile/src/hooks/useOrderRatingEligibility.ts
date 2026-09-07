import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { OrderRatingEligibility } from '../types/ratingsApi';

// Module-level cache + in-flight dedupe so order lists don't fire one
// eligibility request per row, and re-mounts reuse fresh results.
const eligibilityCache = new Map<
  string,
  { at: number; data: OrderRatingEligibility | null }
>();
const inflightRequests = new Map<
  string,
  Promise<OrderRatingEligibility | null>
>();
const CACHE_TTL_MS = 60_000;

/** Drop the cached eligibility for an order (call after submitting a rating). */
export function invalidateOrderRatingEligibility(orderId: string): void {
  eligibilityCache.delete(orderId);
}

async function fetchOrderRatingEligibility(
  orderId: string
): Promise<OrderRatingEligibility | null> {
  const cached = eligibilityCache.get(orderId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  let request = inflightRequests.get(orderId);
  if (!request) {
    request = agentApi.ratings
      .getEligibility(orderId)
      .then((res) => (res.success ? res.eligibility : null))
      .finally(() => inflightRequests.delete(orderId));
    inflightRequests.set(orderId, request);
  }
  const data = await request;
  eligibilityCache.set(orderId, { at: Date.now(), data });
  return data;
}

/**
 * Per-user rating eligibility for an order (drives Rate CTAs).
 * Pass enabled=false to skip fetching (e.g. order not complete yet).
 * State resets whenever the order changes so consumers never act on a
 * previous order's eligibility.
 */
export function useOrderRatingEligibility(
  orderId: string | undefined,
  enabled = true
) {
  const [eligibility, setEligibility] = useState<OrderRatingEligibility | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!orderId || !enabled) return;
    invalidateOrderRatingEligibility(orderId);
    setLoading(true);
    try {
      setEligibility(await fetchOrderRatingEligibility(orderId));
    } catch {
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, enabled]);

  useEffect(() => {
    let cancelled = false;
    // Clear stale data from the previous order immediately.
    setEligibility(null);
    if (!orderId || !enabled) return;
    setLoading(true);
    fetchOrderRatingEligibility(orderId)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, enabled]);

  return { eligibility, loading, refetch };
}
