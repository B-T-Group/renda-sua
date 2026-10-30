import { render } from '@testing-library/react';
import React from 'react';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import CatalogVariantPickerDialog from './CatalogVariantPickerDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

describe('CatalogVariantPickerDialog', () => {
  const formatCurrency = (amount: number) => `$${amount}`;

  it('does not throw when item or nested catalog item is missing', () => {
    expect(() =>
      render(
        <CatalogVariantPickerDialog
          open
          item={null}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          formatCurrency={formatCurrency}
        />
      )
    ).not.toThrow();

    expect(() =>
      render(
        <CatalogVariantPickerDialog
          open
          item={{ id: 'inv-missing-item' } as InventoryItem}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          formatCurrency={formatCurrency}
        />
      )
    ).not.toThrow();
  });
});
