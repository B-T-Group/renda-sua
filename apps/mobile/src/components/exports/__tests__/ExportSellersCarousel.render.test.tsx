import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ExportSellersCarousel } from '../ExportSellersCarousel';
import { ExportsDirectionSwitch } from '../ExportsDirectionSwitch';
import type { ExportSeller } from '../../../types/stores';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../hooks/usePageShare', () => ({
  usePageShare: () => ({ canUseNativeShare: false, shareNative: jest.fn(), copyToClipboard: jest.fn() }),
}));

const seller = (i: number, extra: Partial<ExportSeller> = {}): ExportSeller => ({
  business_location_id: `loc-${i}`,
  business_id: `biz-${i}`,
  name: `Seller ${i}`,
  city: 'Montreal',
  country: 'CA',
  logo_url: null,
  item_count: 20 - i,
  latest_export_at: null,
  is_verified: true,
  can_accept_orders: true,
  is_storefront_visible: true,
  ...extra,
});

async function renderCarousel(sellers: ExportSeller[], total: number) {
  const onPressSeller = jest.fn();
  const onSeeAll = jest.fn();
  const onViewed = jest.fn();
  await renderWithProviders(
    <ThemeProvider>
      <ExportSellersCarousel
        sellers={sellers}
        total={total}
        onPressSeller={onPressSeller}
        onSeeAll={onSeeAll}
        onViewed={onViewed}
      />
    </ThemeProvider>
  );
  return { onPressSeller, onSeeAll, onViewed };
}

describe('ExportSellersCarousel', () => {
  it('renders nothing for 0 sellers', async () => {
    await renderCarousel([], 0);
    expect(screen.queryByTestId('export-sellers-carousel')).toBeNull();
    expect(screen.queryByText('Sellers')).toBeNull();
  });

  it('shows at most 10 cards and a More card only when total > 10', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => seller(i));
    const { onSeeAll, onViewed } = await renderCarousel(twelve, 12);
    expect(screen.getByText('Sellers')).toBeTruthy();
    expect(screen.getByTestId('export-seller-card-9')).toBeTruthy();
    expect(screen.queryByTestId('export-seller-card-10')).toBeNull();
    await fireEvent.press(screen.getByTestId('export-sellers-more-card'));
    expect(onSeeAll).toHaveBeenCalledWith('trailing_card');
    await fireEvent.press(screen.getByTestId('export-sellers-see-all'));
    expect(onSeeAll).toHaveBeenCalledWith('header');
    expect(onViewed).toHaveBeenCalledWith(10, 12);
  });

  it('1–3 sellers: no More card; singular count; monogram when no logo', async () => {
    const { onPressSeller } = await renderCarousel(
      [seller(1, { name: 'Hudson Bay Outfitters', item_count: 1 }), seller(2, { logo_url: 'https://x/logo.png' })],
      2
    );
    expect(screen.queryByTestId('export-sellers-more-card')).toBeNull();
    expect(screen.getByTestId('export-sellers-see-all')).toBeTruthy();
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.getByText('HB')).toBeTruthy();
    expect(screen.getAllByTestId('export-seller-logo')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('export-seller-card-0'));
    expect(onPressSeller).toHaveBeenCalledWith(expect.objectContaining({ business_location_id: 'loc-1' }), 0);
  });

  it('does not paint leftover local stores when total is 0 (legacy directory)', async () => {
    await renderCarousel(
      [
        seller(1, { name: 'Happy store - Yaoundé', country: null }),
        seller(2, { name: 'Home cake - Douala', country: null }),
      ],
      0
    );
    expect(screen.queryByTestId('export-sellers-carousel')).toBeNull();
    expect(screen.queryByText('Happy store - Yaoundé')).toBeNull();
  });

  it('places the See all chevron after the label', async () => {
    await renderCarousel([seller(1)], 1);
    const btn = screen.getByTestId('export-sellers-see-all');
    // RN flattens the icon name into text; the chevron must follow the label.
    expect(btn).toHaveTextContent(/^See allchevron-right$/);
  });
});

describe('ExportsDirectionSwitch one-line counts with sellers', () => {
  const origins = [{ country_code: 'CA', item_count: 71, business_count: 9, destination_codes: ['CD', 'CI', 'CM', 'GA', 'GH', 'SN', 'TG'] }];
  it('From: products · sellers · ships to', async () => {
    await renderWithProviders(
      <ThemeProvider>
        <ExportsDirectionSwitch
          direction="from"
          marketCode="CM"
          originCode="CA"
          origins={origins}
          total={71}
          sellerTotal={12}
          onChangeDirection={jest.fn()}
          onPickOrigin={jest.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByText('71 products · 12 sellers · ships to 7 markets')).toBeTruthy();
  });

  it('Into: products · sellers', async () => {
    await renderWithProviders(
      <ThemeProvider>
        <ExportsDirectionSwitch
          direction="into"
          marketCode="CM"
          originCode="CA"
          origins={origins}
          total={1}
          sellerTotal={1}
          onChangeDirection={jest.fn()}
          onPickOrigin={jest.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByText('1 product · 1 seller')).toBeTruthy();
  });
});
