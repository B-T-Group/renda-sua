import { useEffect, useState } from 'react';
import { useStore } from '../stores/RootStore';
import { fetchMyExportOrders } from '../services/exportOrdersApi';
import { exportOrderIsStopped } from '../utils/exportOrders/exportOrderProgress';

const TTL_MS = 60_000;
const LOOKUP_LIMIT = 50;

type Lookup = Map<string, string>;

let cached: { at: number; value: Lookup } | null = null;
let inflight: Promise<Lookup> | null = null;
const listeners = new Set<() => void>();

async function loadLookup(): Promise<Lookup> {
  const page = await fetchMyExportOrders(1, LOOKUP_LIMIT);
  const lookup: Lookup = new Map();
  for (const order of page?.items ?? []) {
    if (exportOrderIsStopped(order.status)) continue;
    for (const line of order.lines ?? []) {
      if (line.business_inventory_id && !lookup.has(line.business_inventory_id)) {
        lookup.set(line.business_inventory_id, order.id);
      }
    }
  }
  return lookup;
}

function getLookup(): Promise<Lookup> {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.value);
  if (!inflight) {
    inflight = loadLookup()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateExportOrderLookup(): void {
  cached = null;
  listeners.forEach((listener) => listener());
}

/** Id of the client's open export order for this listing, or null when none exists. */
export function useExportOrderForInventory(
  inventoryId: string | undefined,
  enabled: boolean
): string | null {
  const { auth } = useStore();
  const active = enabled && auth.isAuthenticated;
  const [orderId, setOrderId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!active || !inventoryId) {
      setOrderId(null);
      return undefined;
    }
    let stop = false;
    getLookup()
      .then((lookup) => {
        if (!stop) setOrderId(lookup.get(inventoryId) ?? null);
      })
      .catch(() => {
        if (!stop) setOrderId(null);
      });
    return () => {
      stop = true;
    };
  }, [active, inventoryId, version]);

  return orderId;
}
