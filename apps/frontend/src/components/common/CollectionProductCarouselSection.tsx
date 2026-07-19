import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionSummary } from '../../hooks/useCollections';
import { InventoryItem, useInventoryItems } from '../../hooks/useInventoryItems';
import type { PublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { CatalogProductCarousel } from './CatalogProductCarousel';

export interface CollectionProductCarouselSectionProps {
  collection: CollectionSummary;
  businessLocationId?: string | null;
  anonymousOrigin?: PublicBrowserGeo | null;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (
    item: InventoryItem,
    selectionId?: string | null
  ) => void;
  onAddToCart: (
    item: InventoryItem,
    selectionId?: string | null
  ) => void;
  isPublicView: boolean;
  canOrder: boolean;
  showCartButtons: boolean;
  loginButtonText: string;
  orderButtonText: string;
  addToCartButtonText: string;
  buyNowButtonText: string;
}

export function CollectionProductCarouselSection({
  collection,
  businessLocationId,
  anonymousOrigin,
  ...cardProps
}: CollectionProductCarouselSectionProps) {
  const { t } = useTranslation();
  const { inventoryItems, loading } = useInventoryItems({
    page: 1,
    limit: 12,
    is_active: true,
    sort: 'relevance',
    collection: collection.slug,
    business_location_id: businessLocationId ?? undefined,
    anonymousOrigin,
  });

  return (
    <CatalogProductCarousel
      title={collection.name}
      subtitle={collection.description ?? undefined}
      viewAllHref={`/collections/${collection.slug}`}
      items={inventoryItems}
      loading={loading}
      {...cardProps}
    />
  );
}
