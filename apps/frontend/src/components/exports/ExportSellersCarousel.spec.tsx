import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ExportSeller } from '../../utils/exportSellers';
import ExportSellersCarousel from './ExportSellersCarousel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      const opts = typeof defaultValue === 'object' ? defaultValue : {};
      const text = typeof defaultValue === 'string' ? defaultValue : (opts.defaultValue as string) ?? key;
      const out = text.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(opts[k] ?? ''));
      return opts.count === 1 ? out.replace(/items$/, 'item') : out;
    },
  }),
}));

function seller(i: number, extra: Partial<ExportSeller> = {}): ExportSeller {
  return {
    business_location_id: `loc-${i}`,
    business_id: `b-${i}`,
    name: `Seller ${i}`,
    city: 'Toronto',
    country: 'CA',
    logo_url: `https://cdn.example/${i}.png`,
    item_count: 3,
    latest_export_at: null,
    ...extra,
  };
}

function renderCarousel(sellers: ExportSeller[], total: number, extra = {}) {
  return render(
    <MemoryRouter>
      <ExportSellersCarousel
        sellers={sellers}
        total={total}
        sellerHref={(s) => `/exports/ca/sellers/${s.business_location_id}`}
        listHref="/exports/ca/sellers"
        {...extra}
      />
    </MemoryRouter>
  );
}

describe('ExportSellersCarousel', () => {
  it('renders nothing for 0 sellers', () => {
    const { container } = renderCarousel([], 0);
    expect(container.innerHTML).toBe('');
  });

  it('caps at 10 cards and adds a More card + See all only when total > 10', () => {
    const onMore = jest.fn();
    const onViewed = jest.fn();
    renderCarousel(Array.from({ length: 12 }, (_, i) => seller(i)), 12, { onMoreClick: onMore, onViewed });
    expect(screen.getAllByTestId(/^export-seller-card-/)).toHaveLength(10);
    expect(screen.getByTestId('export-sellers-more-card').getAttribute('href')).toBe('/exports/ca/sellers');
    expect(screen.getByTestId('export-sellers-see-all')).toBeTruthy();
    expect(screen.getByText('Sellers')).toBeTruthy();
    fireEvent.click(screen.getByTestId('export-sellers-more-card'));
    expect(onMore).toHaveBeenCalledWith('trailing_card');
    expect(onViewed).toHaveBeenCalledWith(10, 12);
  });

  it('shows a monogram for a seller without a logo, the singular count, and no More at ≤ 10', () => {
    const onSeller = jest.fn();
    renderCarousel([seller(1, { logo_url: null, name: 'Nordiqq Outfitters', item_count: 1 })], 1, {
      onSellerClick: onSeller,
    });
    expect(screen.getByTestId('export-seller-monogram').textContent).toBe('NO');
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.queryByTestId('export-sellers-more-card')).toBeNull();
    expect(screen.getByTestId('export-sellers-see-all')).toBeTruthy();
    expect(screen.getByTestId('export-sellers-see-all').getAttribute('href')).toBe('/exports/ca/sellers');
    const card = screen.getByTestId('export-seller-card-0');
    expect(card.getAttribute('href')).toBe('/exports/ca/sellers/loc-1');
    fireEvent.click(card);
    expect(onSeller).toHaveBeenCalledWith(expect.objectContaining({ business_location_id: 'loc-1' }), 0);
  });

  it('falls back to the monogram when the logo fails to load', () => {
    renderCarousel([seller(2, { name: 'Maple Ridge Foods' })], 1);
    const img = screen.getByTestId('export-seller-logo').querySelector('img') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByTestId('export-seller-monogram').textContent).toBe('MR');
  });

  it('does not paint leftover local stores when total is 0 (legacy directory)', () => {
    renderCarousel(
      [
        seller(1, { name: 'Happy store - Yaoundé', country: null }),
        seller(2, { name: 'Home cake - Douala', country: null }),
      ],
      0
    );
    expect(screen.queryByTestId('export-sellers-carousel')).toBeNull();
    expect(screen.queryByText('Happy store - Yaoundé')).toBeNull();
  });

  it('places the See all chevron after the label', () => {
    renderCarousel([seller(1)], 1);
    const link = screen.getByTestId('export-sellers-see-all');
    const html = link.innerHTML;
    expect(html.indexOf('See all')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('<svg')).toBeGreaterThan(html.indexOf('See all'));
  });
});
