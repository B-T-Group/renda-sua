import {
  Box,
  Button,
  LinearProgress,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogHealthState } from '../../utils/catalogHealth';
import { CatalogEmptyIllustration } from '../illustrations/QuietHomeIllustrations';

type Props = {
  health: CatalogHealthState;
  compact?: boolean;
  onPrimary: () => void;
};

export function BusinessCatalogHealthCard({
  health,
  compact = false,
  onPrimary,
}: Props) {
  const { t } = useTranslation();
  const { primary, approved, target, pendingCount, rejectedCount, isRental } =
    health;

  const title =
    primary === 'first_item'
      ? isRental
        ? t('business.dashboard.firstItem.rentalTitle', 'List your first rental')
        : t('business.dashboard.firstItem.saleTitle', 'Add your first product')
      : t('business.quietHome.catalog.title', 'Catalog health');

  const body =
    primary === 'first_item'
      ? isRental
        ? t(
            'business.dashboard.firstItem.rentalBody',
            'Add photos, set operated or take-home mode, then publish rates at a location.'
          )
        : t(
            'business.dashboard.firstItem.saleBody',
            'Add photos, create the item (AI or manual), then add it to a location.'
          )
      : primary === 'fix_rejected'
        ? t(
            'business.quietHome.catalog.rejectedBody',
            'Fix rejected items so they can go live for customers.'
          )
        : primary === 'restock'
          ? t(
              'business.quietHome.catalog.restockBody',
              'A popular item is out of stock. Restock it while interest is high.'
            )
          : primary === 'add_product'
            ? t(
                'business.quietHome.catalog.progressBody',
                '{{approved}} of {{target}} products live. Fuller catalogs get more discovery.',
                { approved, target }
              )
            : t(
                'business.quietHome.catalog.healthyBody',
                '{{count}} products live.',
                { count: approved }
              );

  const cta =
    primary === 'first_item'
      ? isRental
        ? t('business.dashboard.firstItem.rentalCta', 'Start rental setup')
        : t('business.dashboard.firstItem.saleCta', 'Start guided setup')
      : primary === 'fix_rejected'
        ? t('business.tips.rejectedCta', 'Review items')
        : primary === 'restock'
          ? t('business.tips.restockCta', 'Manage inventory')
          : primary === 'add_product'
            ? t('business.tips.catalogGoalCta', 'Add a product')
            : t('business.quietHome.catalog.manageCta', 'Manage items');

  const metaParts: string[] = [];
  if (pendingCount > 0) {
    metaParts.push(
      t('business.quietHome.catalog.pendingMeta', '{{count}} pending', {
        count: pendingCount,
      })
    );
  }
  if (rejectedCount > 0 && primary !== 'fix_rejected') {
    metaParts.push(
      t('business.quietHome.catalog.rejectedMeta', '{{count}} rejected', {
        count: rejectedCount,
      })
    );
  }

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: primary === 'first_item' ? 'primary.light' : 'divider',
        bgcolor:
          primary === 'first_item' ? 'action.hover' : 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {!compact && primary === 'first_item' ? (
        <CatalogEmptyIllustration
          label={t('business.quietHome.catalog.emptyArt', 'Empty catalog')}
        />
      ) : null}
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {body}
      </Typography>
      {metaParts.length > 0 ? (
        <Typography variant="caption" color="text.secondary">
          {metaParts.join(' · ')}
        </Typography>
      ) : null}
      {primary === 'add_product' ? (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (approved / target) * 100)}
          sx={{ height: 6, borderRadius: 999 }}
        />
      ) : null}
      <Button variant="contained" onClick={onPrimary}>
        {cta}
      </Button>
    </Box>
  );
}

export default BusinessCatalogHealthCard;
