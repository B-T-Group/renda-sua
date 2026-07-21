import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { CartItem, CartProvider, useCart } from './CartContext';

const mockEnqueueSnackbar = jest.fn();

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const createCartItem = (
  variantId?: string,
  quantity = 1,
  price = 100
): CartItem => ({
  inventoryItemId: 'listing-1',
  variantId,
  variantName: variantId ? `Variant ${variantId}` : undefined,
  quantity,
  businessId: 'business-1',
  businessLocationId: 'location-1',
  itemData: {
    name: 'Test item',
    price,
    currency: 'XAF',
  },
});

describe('CartProvider variant and legacy line merging', () => {
  beforeEach(() => {
    localStorage.clear();
    mockEnqueueSnackbar.mockClear();
  });

  it('merges a legacy add into an existing variant line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(createCartItem('variant-1', 2)));
    act(() => result.current.addToCart(createCartItem(undefined, 3)));

    expect(result.current.cartItems).toEqual([
      expect.objectContaining({ variantId: 'variant-1', quantity: 5 }),
    ]);
  });

  it('upgrades a legacy line when the same listing is added with a variant', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(createCartItem(undefined, 2, 100)));
    act(() => result.current.addToCart(createCartItem('variant-1', 1, 125)));

    expect(result.current.cartItems).toEqual([
      expect.objectContaining({
        variantId: 'variant-1',
        variantName: 'Variant variant-1',
        quantity: 3,
        itemData: expect.objectContaining({ price: 125 }),
      }),
    ]);
  });

  it('keeps different variants as separate cart lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(createCartItem('variant-1')));
    act(() => result.current.addToCart(createCartItem('variant-2')));

    expect(result.current.cartItems).toHaveLength(2);
    expect(result.current.cartItems.map((item) => item.variantId)).toEqual([
      'variant-1',
      'variant-2',
    ]);
  });
});
