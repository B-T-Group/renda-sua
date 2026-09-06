import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable, runInAction } from 'mobx';
import type { CartCountryInfo, CartLine } from '../types/cart';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import { buildCartLineFromCatalog } from '../utils/buildCartLineFromCatalog';
import { cartLineKey } from '../utils/cartLineKey';

const CART_STORAGE_KEY = '@RendasuaAgent:shoppingCart';

function clampQty(line: CartLine, qty: number): number {
  const min = line.itemData.minOrderQuantity ?? 1;
  const max = line.itemData.maxOrderQuantity ?? qty;
  return Math.min(Math.max(qty, min), max);
}

export class CartStore {
  items: CartLine[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get lineCount(): number {
    return this.items.reduce((n, l) => n + l.quantity, 0);
  }

  get distinctLineCount(): number {
    return this.items.length;
  }

  /** Map businessId -> lines */
  get groupedByBusiness(): Map<string, CartLine[]> {
    const m = new Map<string, CartLine[]>();
    for (const line of this.items) {
      const arr = m.get(line.businessId) ?? [];
      arr.push(line);
      m.set(line.businessId, arr);
    }
    return m;
  }

  get subtotal(): number {
    return this.items.reduce((s, l) => s + l.itemData.price * l.quantity, 0);
  }

  /**
   * Country information for the cart.
   *
   * - `ok`: all lines have the same known country.
   * - `mixed_countries`: lines from more than one country.
   * - `stale_metadata`: one or more lines are missing `sellerCountry` (added
   *   before the metadata field was introduced). These lines cannot be validated
   *   client-side and may fail backend preflight. Show a refresh-cart prompt.
   * - `unknown`: cart is empty.
   */
  get countryInfo(): CartCountryInfo {
    if (this.items.length === 0) {
      return { status: 'unknown', countries: [], hasStalLines: false };
    }
    const stale = this.items.filter((l) => !l.sellerCountry);
    const hasStalLines = stale.length > 0;
    const countries = [
      ...new Set(this.items.map((l) => l.sellerCountry).filter((c): c is string => !!c)),
    ];
    if (countries.length === 0) {
      return { status: 'stale_metadata', countries: [], hasStalLines: true };
    }
    if (hasStalLines) {
      return { status: 'stale_metadata', countries, hasStalLines: true };
    }
    if (countries.length > 1) {
      return { status: 'mixed_countries', countries, hasStalLines: false };
    }
    return { status: 'ok', countries, hasStalLines: false };
  }

  /** Unique currencies across all lines. */
  get currencies(): string[] {
    return [...new Set(this.items.map((l) => l.itemData.currency).filter(Boolean))];
  }

  /** True when the cart has lines from more than one country. */
  get hasMixedCountries(): boolean {
    return this.countryInfo.status === 'mixed_countries';
  }

  /**
   * True when the cart cannot be checked out because of country/metadata issues.
   * Callers should show a blocking message and not start guest verification.
   */
  get hasCheckoutBlockingCountryIssue(): boolean {
    return (
      this.countryInfo.status === 'mixed_countries' ||
      this.countryInfo.status === 'stale_metadata'
    );
  }

  /** True when any line explicitly has a merchant that is not yet accepting orders. */
  get hasMerchantNotAcceptingLines(): boolean {
    return this.items.some((l) => l.itemData.merchantCanAcceptOrders === false);
  }

  /** Exact cart line for this listing + variant (null/undefined variant = base line). */
  isInCart(inventoryItemId: string, variantId?: string | null): boolean {
    return this.quantityForLine(inventoryItemId, variantId) > 0;
  }

  /** True when any variant of this inventory listing is in the cart. */
  isListingInCart(inventoryItemId: string): boolean {
    return this.quantityForListing(inventoryItemId) > 0;
  }

  quantityForLine(inventoryItemId: string, variantId?: string | null): number {
    const key = cartLineKey(inventoryItemId, variantId);
    return (
      this.items.find((l) => cartLineKey(l.inventoryItemId, l.variantId) === key)?.quantity ?? 0
    );
  }

  /** Sum of quantities across all variants for this inventory listing. */
  quantityForListing(inventoryItemId: string): number {
    return this.items
      .filter((l) => l.inventoryItemId === inventoryItemId)
      .reduce((sum, l) => sum + l.quantity, 0);
  }

  async hydrateFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      runInAction(() => {
        this.items = parsed.filter((x) => x && typeof x.inventoryItemId === 'string') as CartLine[];
      });
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    this.items = [];
    void AsyncStorage.removeItem(CART_STORAGE_KEY);
  }

  schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
    }, 350);
  }

  addFromCatalog(
    catalogItem: CatalogInventoryItem,
    quantity = 1,
    variantId?: string | null,
    baseVariantLabel = 'Default'
  ): 'added' | 'updated' | 'needs_variant' {
    const activeVariants = (catalogItem.item.item_variants ?? []).filter(
      (v) => v.is_active !== false
    );
    if (activeVariants.length >= 1 && !variantId) {
      return 'needs_variant';
    }
    let incoming: CartLine;
    try {
      incoming = buildCartLineFromCatalog(
        catalogItem,
        quantity,
        variantId,
        baseVariantLabel
      );
    } catch {
      return 'needs_variant';
    }
    const key = cartLineKey(incoming.inventoryItemId, incoming.variantId);
    const idx = this.items.findIndex(
      (l) => cartLineKey(l.inventoryItemId, l.variantId) === key
    );

    if (idx >= 0) {
      const existing = this.items[idx];
      const max = existing.itemData.maxOrderQuantity;
      const nextQty = existing.quantity + incoming.quantity;
      const finalQty = max ? Math.min(nextQty, max) : nextQty;
      runInAction(() => {
        const next = [...this.items];
        next[idx] = { ...existing, quantity: finalQty };
        this.items = next;
      });
      this.schedulePersist();
      return 'updated';
    }

    runInAction(() => {
      this.items = [...this.items, incoming];
    });
    this.schedulePersist();
    return 'added';
  }

  updateQuantity(inventoryItemId: string, quantity: number, variantId?: string | null): void {
    const key = cartLineKey(inventoryItemId, variantId);
    const idx = this.items.findIndex((l) => cartLineKey(l.inventoryItemId, l.variantId) === key);
    if (idx < 0) return;
    if (quantity <= 0) {
      this.removeLine(inventoryItemId, variantId);
      return;
    }
    const line = this.items[idx];
    const q = clampQty(line, quantity);
    runInAction(() => {
      const next = [...this.items];
      next[idx] = { ...line, quantity: q };
      this.items = next;
    });
    this.schedulePersist();
  }

  removeLine(inventoryItemId: string, variantId?: string | null): void {
    const key = cartLineKey(inventoryItemId, variantId);
    runInAction(() => {
      this.items = this.items.filter((l) => cartLineKey(l.inventoryItemId, l.variantId) !== key);
    });
    this.schedulePersist();
  }
}
