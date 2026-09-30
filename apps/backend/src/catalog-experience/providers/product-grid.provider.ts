import { Injectable } from '@nestjs/common';
import { localizedCopy } from '../catalog-experience.geo';
import type {
  CatalogExperienceContext,
  CatalogModule,
  CatalogModuleProvider,
} from '../catalog-experience.types';

@Injectable()
export class ProductGridProvider implements CatalogModuleProvider {
  readonly id = 'grid';

  supports(): boolean {
    return true;
  }

  build(context: CatalogExperienceContext): Promise<CatalogModule> {
    return Promise.resolve({
      id: 'catalog-grid',
      type: 'PRODUCT_GRID',
      title: localizedCopy(context.language, 'Full catalog', 'Tout le catalogue'),
      source: {
        path: '/inventory-items',
        query: gridQuery(context),
      },
    });
  }
}

function gridQuery(context: CatalogExperienceContext): Record<string, string> {
  const query: Record<string, string> = {};
  if (context.country) query.country_code = context.country;
  if (context.state) query.state = context.state;
  return query;
}
