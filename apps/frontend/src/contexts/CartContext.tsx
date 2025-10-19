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

export interface CartItem {
  inventoryItemId: string;
  quantity: number;
  businessId: string;
  businessLocationId: string;
  itemData: {
    name: string;
    price: number;
    currency: string;
    imageUrl?: string;
    weight?: number;
  };
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (inventoryItemId: string) => void;
  updateQuantity: (inventoryItemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartItemCount: () => number;
  getCartByBusiness: () => Map<string, CartItem[]>;
  getCartTotal: () => number;
  isItemInCart: (inventoryItemId: string) => boolean;
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
        const existingItemIndex = prevItems.findIndex(
          (cartItem) => cartItem.inventoryItemId === item.inventoryItemId
        );

        if (existingItemIndex >= 0) {
          // Update quantity if item already exists
          const updatedItems = [...prevItems];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + item.quantity,
          };
          enqueueSnackbar(
            t('cart.itemUpdated', 'Item quantity updated in cart'),
            { variant: 'success' }
          );
          return updatedItems;
        } else {
          // Add new item
          enqueueSnackbar(t('cart.itemAdded', 'Item added to cart'), {
            variant: 'success',
          });
          return [...prevItems, item];
        }
      });
    },
    [enqueueSnackbar, t]
  );

  const removeFromCart = useCallback(
    (inventoryItemId: string) => {
      setCartItems((prevItems) => {
        const updatedItems = prevItems.filter(
          (item) => item.inventoryItemId !== inventoryItemId
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
    (inventoryItemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(inventoryItemId);
        return;
      }

      setCartItems((prevItems) => {
        const updatedItems = prevItems.map((item) =>
          item.inventoryItemId === inventoryItemId
            ? { ...item, quantity }
            : item
        );
        enqueueSnackbar(t('cart.quantityUpdated', 'Quantity updated'), {
          variant: 'success',
        });
        return updatedItems;
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
    return cartItems.reduce(
      (total, item) => total + item.itemData.price * item.quantity,
      0
    );
  }, [cartItems]);

  const isItemInCart = useCallback(
    (inventoryItemId: string) => {
      return cartItems.some((item) => item.inventoryItemId === inventoryItemId);
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
