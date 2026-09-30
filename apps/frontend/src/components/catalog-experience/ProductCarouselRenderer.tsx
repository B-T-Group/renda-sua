import React from 'react';
import { CatalogProductCarousel } from '../common/CatalogProductCarousel';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import type { ProductCarouselModule } from './catalogExperience.types';

export interface CatalogCardActions {
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem, selectionId?: string | null) => void;
  onAddToCart: (item: InventoryItem, selectionId?: string | null) => void;
  isPublicView: boolean;
  canOrder: boolean;
  showCartButtons: boolean;
  loginButtonText: string;
  orderButtonText: string;
  addToCartButtonText: string;
  buyNowButtonText: string;
}

export function ProductCarouselRenderer({
  module,
  actions,
  onProductClick,
  onSeeAll,
}: {
  module: ProductCarouselModule;
  actions: CatalogCardActions;
  onProductClick: (position: number, productId: string) => void;
  onSeeAll?: () => void;
}) {
  const track = (action: CatalogCardActions['onOrderClick']) =>
    withProductClick(module.products, onProductClick, action);
  return (
    <CatalogProductCarousel
      title={module.title}
      subtitle={module.subtitle}
      items={module.products}
      loading={false}
      onViewAll={onSeeAll}
      {...actions}
      onOrderClick={track(actions.onOrderClick)}
      onAddToCart={track(actions.onAddToCart)}
    />
  );
}

function withProductClick(
  products: InventoryItem[],
  onProductClick: (position: number, productId: string) => void,
  action: CatalogCardActions['onOrderClick']
): CatalogCardActions['onOrderClick'] {
  return (selected, selectionId) => {
    const position = products.findIndex((row) => row.id === selected.id);
    onProductClick(Math.max(position, 0), selected.item_id || selected.id);
    action(selected, selectionId);
  };
}
