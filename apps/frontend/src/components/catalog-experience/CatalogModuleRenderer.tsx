import React from 'react';
import { CategoryCarouselRenderer } from './CategoryCarouselRenderer';
import { CollectionCarouselRenderer } from './CollectionCarouselRenderer';
import {
  ProductCarouselRenderer,
  type CatalogCardActions,
} from './ProductCarouselRenderer';
import type { CatalogModule } from './catalogExperience.types';

interface RendererProps {
  module: CatalogModule;
  actions: CatalogCardActions;
  onCategorySelect: (name: string) => void;
  onModuleClick: (position: number, extra?: Record<string, unknown>) => void;
  onSeeAllDeals?: () => void;
}

const renderers: Record<string, React.FC<RendererProps>> = {
  CATEGORY_CAROUSEL: CategoryModule,
  COLLECTION_CAROUSEL: CollectionModule,
  PRODUCT_CAROUSEL: ProductModule,
  RECENTLY_VIEWED: ProductModule,
  PRODUCT_GRID: HiddenGrid,
};

export function CatalogModuleRenderer({
  module,
  actions,
  onCategorySelect,
  onModuleClick,
  onSeeAllDeals,
}: RendererProps) {
  const Renderer = renderers[module.type] ?? HiddenGrid;
  return (
    <Renderer
      module={module}
      actions={actions}
      onCategorySelect={onCategorySelect}
      onModuleClick={onModuleClick}
      onSeeAllDeals={onSeeAllDeals}
    />
  );
}

function HiddenGrid(_props: RendererProps) {
  return null;
}

function CategoryModule({
  module,
  onCategorySelect,
  onModuleClick,
}: RendererProps) {
  if (module.type !== 'CATEGORY_CAROUSEL') return null;
  return (
    <CategoryCarouselRenderer
      title={module.title}
      items={module.items}
      onSelect={(item, position) => {
        onModuleClick(position, { categoryId: item.id });
        onCategorySelect(item.name);
      }}
    />
  );
}

function CollectionModule({ module, onModuleClick }: RendererProps) {
  if (module.type !== 'COLLECTION_CAROUSEL') return null;
  return (
    <CollectionCarouselRenderer
      module={module}
      onOpen={(position, collectionId) =>
        onModuleClick(position, { collectionId })
      }
    />
  );
}

function ProductModule({
  module,
  actions,
  onModuleClick,
  onSeeAllDeals,
}: RendererProps) {
  if (module.type !== 'PRODUCT_CAROUSEL' && module.type !== 'RECENTLY_VIEWED') {
    return null;
  }
  return (
    <ProductCarouselRenderer
      module={module}
      actions={actions}
      onProductClick={(position, productId) =>
        onModuleClick(position, { productId })
      }
      onSeeAll={module.id === 'deals-near-you' ? onSeeAllDeals : undefined}
    />
  );
}
