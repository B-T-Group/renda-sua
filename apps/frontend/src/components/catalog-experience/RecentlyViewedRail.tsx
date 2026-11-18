import { Box, Skeleton } from '@mui/material';
import React from 'react';
import {
  useCatalogExperience,
  type CatalogExperienceSurface,
} from '../../hooks/useCatalogExperience';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { CatalogModuleRenderer } from './CatalogModuleRenderer';
import type { CatalogCardActions } from './ProductCarouselRenderer';

/**
 * Surface-scoped "Pick up where you left off" rail. Hidden when the flag is
 * off, the shopper is signed out, or there are no matching recent views.
 */
export function RecentlyViewedRail({
  surface,
  actions,
}: {
  surface: Exclude<CatalogExperienceSurface, 'all' | 'rentals'>;
  actions: CatalogCardActions;
}) {
  const { flags } = useClientFlags();
  const { isAuthenticated } = useSessionAuth();
  const enabled = flags.catalog_experience_v1 && isAuthenticated;
  const { modules, loading } = useCatalogExperience(enabled, surface);
  const rail = modules.find(
    (module) =>
      module.type === 'RECENTLY_VIEWED' &&
      module.products.length > 0
  );

  if (!enabled) return null;
  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, overflow: 'hidden' }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" width={148} height={156} />
        ))}
      </Box>
    );
  }
  if (!rail) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <CatalogModuleRenderer
        module={rail}
        actions={actions}
        onCategorySelect={() => undefined}
        onModuleClick={() => undefined}
      />
    </Box>
  );
}
