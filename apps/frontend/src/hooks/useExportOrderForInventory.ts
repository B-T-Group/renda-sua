import { useEffect, useState } from 'react';
import { exportOrderIsStopped } from '../utils/exportOrders/exportOrderProgress';
import { useExportOrders } from './useExportOrders';

const TTL_MS = 60_000;
const LOOKUP_LIMIT = 50;

type Lookup = Map<string, string>;

interface OrderLine {
  business_inventory_id?: string | null;
}

interface OrderSummary {
  id: string;
  status: string;
  lines?: OrderLine[];
}

let cached: { at: number; value: Lookup } | null = null;
let inflight: Promise<Lookup> | null = null;
const listeners = new Set<() => void>();

function buildLookup(orders: OrderSummary[]): Lookup {
  const lookup: Lookup = new Map();
  for (const order of orders) {
    if (exportOrderIsStopped(order.status)) continue;
    for (const line of order.lines ?? []) {
      const key = line.business_inventory_id;
      if (key && !lookup.has(key)) lookup.set(key, order.id);
    }
  }
  return lookup;
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
  const { listMine } = useExportOrders();
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
    if (!enabled || !inventoryId) {
      setOrderId(null);
      return undefined;
    }
    let stop = false;
    const load = (): Promise<Lookup> => {
      if (cached && Date.now() - cached.at < TTL_MS) {
        return Promise.resolve(cached.value);
      }
      if (!inflight) {
        inflight = listMine(1, LOOKUP_LIMIT)
          .then((page: { items?: OrderSummary[] } | undefined) => {
            const value = buildLookup(page?.items ?? []);
            cached = { at: Date.now(), value };
            return value;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    };
    load()
      .then((lookup) => !stop && setOrderId(lookup.get(inventoryId) ?? null))
      .catch(() => !stop && setOrderId(null));
    return () => {
      stop = true;
    };
  }, [enabled, inventoryId, listMine, version]);

  return orderId;
}
