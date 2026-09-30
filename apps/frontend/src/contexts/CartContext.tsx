import { useSnackbar } from 'notistack';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cartLineKey } from './cartLineKey';
import { cappedCartQuantity } from '../utils/cartLineCap';

export interface CartItem {
  inventoryItemId: string;
  /** Catalog variant when chosen (distinct cart lines per variant). */
  variantId?: string;
  variantName?: string;
  quantity: number;
  businessId: string;
  businessLocationId: string;
  itemData: {
    name: string;
    price: number;
    currency: string;
    imageUrl?: string;
    /** When listing shows a variant-specific photo */
    variantImageUrl?: string;
    weight?: number;
    maxOrderQuantity?: number;
    minOrderQuantity?: number;
    /** Base units in one purchase of this line. Defaults to 1. */
    packQuantity?: number;
    /** Shared stock in base units at add time. Omitted for cooked food. */
    availableQuantity?: number;
    /** For Meta Pixel Purchase `content_category` (from item taxonomy when known). */
    contentCategory?: string;
    /** For Meta Pixel Purchase `google_product_category` when known. */
    googleProductCategory?: string;
    originalPrice?: number;
    discountedPrice?: number;
    hasActiveDeal?: boolean;
    dealEndAt?: string;
    merchantCanAcceptOrders?: boolean;
  };
}

interface CartContextType {
  cartItems: CartItem[];
  /**
   * Adds a line to the cart. Callers must supply `variantId` when the listing
   * has multiple active variants (use catalog helpers / detail selection).
   */
  addToCart: (item: CartItem) => void;
  removeFromCart: (inventoryItemId: string, variantId?: string) => void;
  updateQuantity: (
    inventoryItemId: string,
    quantity: number,
    variantId?: string
  ) => void;
  clearCart: () => void;
  /** Replace entire cart without per-item snackbars (reorder). */
  replaceItems: (items: CartItem[]) => void;
  /** Merge lines into cart without per-item snackbars (reorder add). */
  addItems: (items: CartItem[]) => void;
  getCartItemCount: () => number;
  getCartByBusiness: () => Map<string, CartItem[]>;
  getCartTotal: () => number;
  isItemInCart: (inventoryItemId: string, variantId?: string) => boolean;
  /** True when any variant of this listing is in the cart. */
  isListingInCart: (inventoryItemId: string) => boolean;
  /** Sum of quantities across all variants for this listing. */
  getListingQuantityInCart: (inventoryItemId: string) => number;
  /** Quantity for an exact cart line (listing + optional variant). */
  getLineQuantityInCart: (
    inventoryItemId: string,
    variantId?: string
  ) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'rendasua_cart';

export const CartProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Initialize cart from localStorage immediately
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      console.log('Raw localStorage value:', savedCart);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        console.log('Parsed cart:', parsedCart);
        if (Array.isArray(parsedCart)) {
          console.log('Cart loaded from localStorage:', parsedCart);
          return parsedCart;
        } else {
          console.warn('Parsed cart is not an array:', parsedCart);
        }
      } else {
        console.log('No saved cart found in localStorage');
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
    }
    console.log('Cart initialized as empty array');
    return [];
  });

  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  // Debug: Log when CartProvider mounts/unmounts
  useEffect(() => {
    console.log('CartProvider mounted');
    return () => {
      console.log('CartProvider unmounting');
    };
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      console.log('Saving cart to localStorage:', cartItems);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [cartItems]);

  const addToCart = useCallback(
    (item: CartItem) => {
      setCartItems((prevItems) => {
        const lineKey = cartLineKey(item.inventoryItemId, item.variantId);
        let existingItemIndex = prevItems.findIndex(
          (cartItem) =>
            cartLineKey(cartItem.inventoryItemId, cartItem.variantId) ===
            lineKey
        );

        // Merge when one line has a variantId and the other does not (same listing).
        // Covers list/card adds that stamp a single variant vs detail adds before selection init.
        if (existingItemIndex < 0) {
          existingItemIndex = prevItems.findIndex(
            (cartItem) =>
              cartItem.inventoryItemId === item.inventoryItemId &&
              Boolean(cartItem.variantId) !== Boolean(item.variantId)
          );
        }

        if (existingItemIndex >= 0) {
          // Update quantity if item already exists
          const updatedItems = [...prevItems];
          const existing = updatedItems[existingItemIndex];
          const nextQuantity = existing.quantity + item.quantity;
          const finalQuantity = cappedCartQuantity(
            existing,
            nextQuantity,
            prevItems
          );

          if (finalQuantity < nextQuantity) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: finalQuantity }
              ),
              { variant: 'warning' }
            );
          }

          updatedItems[existingItemIndex] = {
            ...existing,
            ...(!existing.variantId && item.variantId
              ? {
                  variantId: item.variantId,
                  variantName: item.variantName,
                }
              : {}),
            quantity: finalQuantity,
            itemData: {
              ...existing.itemData,
              // Prefer current listing/variant pricing when upgrading a legacy line.
              ...(!existing.variantId && item.variantId
                ? {
                    price: item.itemData.price,
                    originalPrice: item.itemData.originalPrice,
                    discountedPrice: item.itemData.discountedPrice,
                    hasActiveDeal: item.itemData.hasActiveDeal,
                    dealEndAt: item.itemData.dealEndAt,
                    imageUrl: item.itemData.imageUrl ?? existing.itemData.imageUrl,
                    variantImageUrl:
                      item.itemData.variantImageUrl ??
                      existing.itemData.variantImageUrl,
                    packQuantity:
                      item.itemData.packQuantity ?? existing.itemData.packQuantity,
                    availableQuantity:
                      item.itemData.availableQuantity ??
                      existing.itemData.availableQuantity,
                  }
                : !existing.itemData.variantImageUrl &&
                    item.itemData.variantImageUrl
                  ? { variantImageUrl: item.itemData.variantImageUrl }
                  : {}),
            },
          };
          enqueueSnackbar(
            t('cart.itemUpdated', 'Item quantity updated in cart'),
            { variant: 'success' }
          );
          return updatedItems;
        } else {
          const initialQuantity = cappedCartQuantity(
            item,
            item.quantity,
            prevItems
          );

          if (initialQuantity <= 0) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: 0 }
              ),
              { variant: 'warning' }
            );
            return prevItems;
          }

          if (initialQuantity < item.quantity) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: initialQuantity }
              ),
              { variant: 'warning' }
            );
          }

          // Add new item
          enqueueSnackbar(t('cart.itemAdded', 'Item added to cart'), {
            variant: 'success',
          });
          return [
            ...prevItems,
            {
              ...item,
              quantity: initialQuantity,
            },
          ];
        }
      });
    },
    [enqueueSnackbar, t]
  );

  const removeFromCart = useCallback(
    (inventoryItemId: string, variantId?: string) => {
      setCartItems((prevItems) => {
        const lineKey = cartLineKey(inventoryItemId, variantId);
        const updatedItems = prevItems.filter(
          (item) =>
            cartLineKey(item.inventoryItemId, item.variantId) !== lineKey
        );
        enqueueSnackbar(t('cart.itemRemoved', 'Item removed from cart'), {
          variant: 'info',
        });
        return updatedItems;
      });
    },
    [enqueueSnackbar, t]
  );

  const updateQuantity = useCallback(
    (inventoryItemId: string, quantity: number, variantId?: string) => {
      setCartItems((prevItems) => {
        const nextItems: CartItem[] = [];
        const lineKey = cartLineKey(inventoryItemId, variantId);

        prevItems.forEach((item) => {
          if (
            cartLineKey(item.inventoryItemId, item.variantId) !== lineKey
          ) {
            nextItems.push(item);
            return;
          }

          if (quantity <= 0) {
            return;
          }

          const finalQuantity = cappedCartQuantity(item, quantity, prevItems);
          if (finalQuantity <= 0) {
            return;
          }

          if (finalQuantity < quantity) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: finalQuantity }
              ),
              { variant: 'warning' }
            );
          }

          nextItems.push({
            ...item,
            quantity: finalQuantity,
          });
        });

        enqueueSnackbar(t('cart.quantityUpdated', 'Quantity updated'), {
          variant: 'success',
        });

        return nextItems;
      });
    },
    [removeFromCart, enqueueSnackbar, t]
  );

  const clearCart = useCallback(() => {
    console.log('Clearing cart');
    setCartItems([]);
    enqueueSnackbar(t('cart.cleared', 'Cart cleared'), { variant: 'info' });
  }, [enqueueSnackbar, t]);

  const replaceItems = useCallback((items: CartItem[]) => {
    setCartItems(items);
  }, []);

  const addItems = useCallback((items: CartItem[]) => {
    setCartItems((prevItems) => {
      const next = [...prevItems];
      for (const incoming of items) {
        const key = cartLineKey(incoming.inventoryItemId, incoming.variantId);
        const idx = next.findIndex(
          (row) => cartLineKey(row.inventoryItemId, row.variantId) === key
        );
        if (idx >= 0) {
          const existing = next[idx];
          const merged = existing.quantity + incoming.quantity;
          next[idx] = {
            ...existing,
            quantity: cappedCartQuantity(existing, merged, next),
          };
        } else {
          const quantity = cappedCartQuantity(
            incoming,
            incoming.quantity,
            next
          );
          if (quantity > 0) next.push({ ...incoming, quantity });
        }
      }
      return next;
    });
  }, []);

  const getCartItemCount = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const getCartByBusiness = useCallback(() => {
    const cartByBusiness = new Map<string, CartItem[]>();
    cartItems.forEach((item) => {
      const businessItems = cartByBusiness.get(item.businessId) || [];
      businessItems.push(item);
      cartByBusiness.set(item.businessId, businessItems);
    });
    return cartByBusiness;
  }, [cartItems]);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const hasDeal =
        item.itemData.hasActiveDeal &&
        typeof item.itemData.originalPrice === 'number' &&
        typeof item.itemData.discountedPrice === 'number' &&
        item.itemData.originalPrice > 0;

      const unitPrice = hasDeal
        ? item.itemData.discountedPrice!
        : item.itemData.price;

      return total + unitPrice * item.quantity;
    }, 0);
  }, [cartItems]);

  const getLineQuantityInCart = useCallback(
    (inventoryItemId: string, variantId?: string) => {
      const lineKey = cartLineKey(inventoryItemId, variantId);
      return (
        cartItems.find(
          (item) =>
            cartLineKey(item.inventoryItemId, item.variantId) === lineKey
        )?.quantity ?? 0
      );
    },
    [cartItems]
  );

  const getListingQuantityInCart = useCallback(
    (inventoryItemId: string) => {
      return cartItems
        .filter((item) => item.inventoryItemId === inventoryItemId)
        .reduce((sum, item) => sum + item.quantity, 0);
    },
    [cartItems]
  );

  const isItemInCart = useCallback(
    (inventoryItemId: string, variantId?: string) => {
      return getLineQuantityInCart(inventoryItemId, variantId) > 0;
    },
    [getLineQuantityInCart]
  );

  const isListingInCart = useCallback(
    (inventoryItemId: string) => getListingQuantityInCart(inventoryItemId) > 0,
    [getListingQuantityInCart]
  );

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    replaceItems,
    addItems,
    getCartItemCount,
    getCartByBusiness,
    getCartTotal,
    isItemInCart,
    isListingInCart,
    getListingQuantityInCart,
    getLineQuantityInCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
