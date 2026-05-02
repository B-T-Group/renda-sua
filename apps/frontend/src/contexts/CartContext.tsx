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
    /** For Meta Pixel Purchase `content_category` (from item taxonomy when known). */
    contentCategory?: string;
    /** For Meta Pixel Purchase `google_product_category` when known. */
    googleProductCategory?: string;
    originalPrice?: number;
    discountedPrice?: number;
    hasActiveDeal?: boolean;
    dealEndAt?: string;
  };
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (inventoryItemId: string, variantId?: string) => void;
  updateQuantity: (
    inventoryItemId: string,
    quantity: number,
    variantId?: string
  ) => void;
  clearCart: () => void;
  getCartItemCount: () => number;
  getCartByBusiness: () => Map<string, CartItem[]>;
  getCartTotal: () => number;
  isItemInCart: (inventoryItemId: string, variantId?: string) => boolean;
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
        const existingItemIndex = prevItems.findIndex(
          (cartItem) =>
            cartLineKey(cartItem.inventoryItemId, cartItem.variantId) ===
            lineKey
        );

        if (existingItemIndex >= 0) {
          // Update quantity if item already exists
          const updatedItems = [...prevItems];
          const existing = updatedItems[existingItemIndex];
          const max = existing.itemData.maxOrderQuantity;
          const nextQuantity = existing.quantity + item.quantity;
          const finalQuantity = max ? Math.min(nextQuantity, max) : nextQuantity;

          if (max && nextQuantity > max) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: max }
              ),
              { variant: 'warning' }
            );
          }

          updatedItems[existingItemIndex] = {
            ...existing,
            quantity: finalQuantity,
          };
          enqueueSnackbar(
            t('cart.itemUpdated', 'Item quantity updated in cart'),
            { variant: 'success' }
          );
          return updatedItems;
        } else {
          const max = item.itemData.maxOrderQuantity;
          const initialQuantity = max ? Math.min(item.quantity, max) : item.quantity;

          if (max && item.quantity > max) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: max }
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

          const max = item.itemData.maxOrderQuantity;
          const finalQuantity = max && quantity > max ? max : quantity;

          if (max && quantity > max) {
            enqueueSnackbar(
              t(
                'cart.maxQuantityReached',
                'Maximum {{count}} per order for this item',
                { count: max }
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

  const isItemInCart = useCallback(
    (inventoryItemId: string, variantId?: string) => {
      const lineKey = cartLineKey(inventoryItemId, variantId);
      return cartItems.some(
        (item) =>
          cartLineKey(item.inventoryItemId, item.variantId) === lineKey
      );
    },
    [cartItems]
  );

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItemCount,
    getCartByBusiness,
    getCartTotal,
    isItemInCart,
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
