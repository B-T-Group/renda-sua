import { render } from '@testing-library/react';
import React from 'react';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import DashboardItemCard from './DashboardItemCard';

describe('DashboardItemCard', () => {
  const formatCurrency = (amount: number) => `$${amount}`;
  const onOrderClick = jest.fn();

  it('does not throw when the listing or nested catalog item is missing', () => {
    expect(() =>
      render(
        <DashboardItemCard
          item={undefined as unknown as InventoryItem}
          formatCurrency={formatCurrency}
          onOrderClick={onOrderClick}
        />
      )
    ).not.toThrow();

    expect(() =>
      render(
        <DashboardItemCard
          item={{ id: 'inv-missing-item' } as InventoryItem}
          formatCurrency={formatCurrency}
          onOrderClick={onOrderClick}
        />
      )
    ).not.toThrow();
  });
});
