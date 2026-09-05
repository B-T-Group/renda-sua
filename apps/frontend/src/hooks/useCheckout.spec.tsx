import { act, renderHook } from '@testing-library/react';
import type { CartItem } from '../contexts/CartContext';
import { useCheckout } from './useCheckout';

const mockEnqueueSnackbar = jest.fn();
const mockNavigate = jest.fn();
const mockClearCart = jest.fn();
const mockTrackPurchase = jest.fn();
const mockTrackInitiateCheckout = jest.fn();
const mockPost = jest.fn();
let mockApiClient: { post: jest.Mock } | null = { post: mockPost };

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('../contexts/CartContext', () => ({
  useCart: () => ({ clearCart: mockClearCart }),
}));

jest.mock('./useMetaPixel', () => ({
  useMetaPixel: () => ({
    trackPurchase: mockTrackPurchase,
    trackInitiateCheckout: mockTrackInitiateCheckout,
  }),
}));

jest.mock('../utils/metaEventIds', () => ({
  metaCheckoutEventId: jest.fn().mockResolvedValue('checkout-test'),
  metaPurchaseEventId: (orderId: string) => `purchase-${orderId}`,
}));

jest.mock('../utils/metaBrowserIds', () => ({
  getMetaBrowserContext: () => ({}),
}));

const cartItem: CartItem = {
  inventoryItemId: 'inv-1',
  quantity: 1,
  businessId: 'biz-1',
  businessLocationId: 'loc-1',
  itemData: { name: 'Item', price: 1000, currency: 'XAF' },
};

const paidOrder = {
  id: 'order-1',
  order_number: 'ORD-1',
  total_amount: 1000,
  currency: 'XAF',
  current_status: 'pending',
  business_id: 'biz-1',
  payment_status: 'pending',
};

function mockSuccessfulCheckout() {
  mockPost
    .mockResolvedValueOnce({
      data: {
        can_proceed: true,
        groups: [{ total: 1000, currency: 'XAF' }],
        delivery_availability: { available: true },
      },
    })
    .mockResolvedValueOnce({
      data: { success: true, order: paidOrder },
    });
}

describe('useCheckout loading lock', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockEnqueueSnackbar.mockReset();
    mockClearCart.mockReset();
    mockTrackPurchase.mockReset();
    mockTrackInitiateCheckout.mockReset();
    mockApiClient = { post: mockPost };
  });

  it('keeps loading true after a successful cart checkout so Place order cannot fire again', async () => {
    mockSuccessfulCheckout();
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.createOrdersFromCart(
        [cartItem],
        'addr-1',
        '237600000000'
      );
    });

    expect(result.current.loading).toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      '/orders',
      expect.objectContaining({
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      })
    );
    expect(mockClearCart).toHaveBeenCalledTimes(1);
  });

  it('releases loading after a failed cart checkout so the shopper can retry', async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          can_proceed: true,
          groups: [{ total: 1000, currency: 'XAF' }],
          delivery_availability: { available: true },
        },
      })
      .mockRejectedValueOnce({
        response: { data: { message: 'Card declined' } },
      });
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await expect(
        result.current.createOrdersFromCart([cartItem], 'addr-1')
      ).rejects.toMatchObject({
        response: { data: { message: 'Card declined' } },
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Card declined');
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it('keeps loading true after a successful single-item order', async () => {
    mockPost.mockResolvedValueOnce({
      data: { success: true, order: paidOrder },
    });
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.createSingleOrder(
        'inv-1',
        1,
        'biz-1',
        'addr-1'
      );
    });

    expect(result.current.loading).toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
