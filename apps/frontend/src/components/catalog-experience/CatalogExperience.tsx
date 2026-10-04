import { Box, Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
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
        <motion.div
          key={module.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: position * 0.04 }}
        >
        <CatalogModuleRenderer
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
        </motion.div>
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
