import { Box, Skeleton } from '@mui/material';
import React, { useEffect } from 'react';
import {
  SITE_EVENT_CATALOG_MODULE_CLICK,
  SITE_EVENT_CATALOG_MODULE_IMPRESSION,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import { CatalogModuleRenderer } from './CatalogModuleRenderer';
import type { CatalogCardActions } from './ProductCarouselRenderer';
import { useCatalogExperience } from '../../hooks/useCatalogExperience';
import { isVisualCatalogModule } from './catalogExperience.types';

export function CatalogExperience({
  enabled,
  actions,
  onCategorySelect,
  onSeeAllDeals,
  onUnavailable,
}: {
  enabled: boolean;
  actions: CatalogCardActions;
  onCategorySelect: (name: string) => void;
  onSeeAllDeals?: () => void;
  onUnavailable?: () => void;
}) {
  const { modules, loading, failed } = useCatalogExperience(enabled);
  const { trackSiteEvent } = useTrackSiteEvent();
  const visible = modules.filter(isVisualCatalogModule);

  useEffect(() => {
    if (!loading && failed) onUnavailable?.();
  }, [loading, failed, onUnavailable]);

  useEffect(() => {
    modules.filter(isVisualCatalogModule).forEach((module, position) => {
      void trackSiteEvent({
        eventType: SITE_EVENT_CATALOG_MODULE_IMPRESSION,
        metadata: { moduleId: module.id, moduleType: module.type, position },
      });
    });
  }, [modules, trackSiteEvent]);

  if (!enabled) return null;
  if (loading) return <ExperienceSkeleton />;
  if (visible.length === 0) return null;

  return (
    <Box sx={{ mb: 1 }}>
      {visible.map((module, position) => (
        <CatalogModuleRenderer
          key={module.id}
          module={module}
          actions={actions}
          onCategorySelect={onCategorySelect}
          onSeeAllDeals={onSeeAllDeals}
          onModuleClick={(itemPosition, extra) => {
            void trackSiteEvent({
              eventType: SITE_EVENT_CATALOG_MODULE_CLICK,
              metadata: {
                moduleId: module.id,
                moduleType: module.type,
                position: itemPosition,
                modulePosition: position,
                ...extra,
              },
            });
          }}
        />
      ))}
    </Box>
  );
}

function ExperienceSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, overflow: 'hidden' }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} variant="rounded" width={148} height={156} />
      ))}
    </Box>
  );
}
