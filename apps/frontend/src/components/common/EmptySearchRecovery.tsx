import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Grid,
  Paper,
  Stack,
  Link as MuiLink,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type {
  SearchRecoveryData,
  RecoveryFilterRemoval,
  RecoveryRung,
} from '../../hooks/useSearchRecovery';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import DashboardItemCard from './DashboardItemCard';

export interface EmptySearchRecoveryProps {
  recovery: SearchRecoveryData;
  originalQuery: string;
  onSearchOriginal: () => void;
  onRemoveFilter: (filter: RecoveryFilterRemoval['filter']) => void;
  onBrowseCategory: (categoryId: number | null, categoryName: string) => void;
  onAskRenda: (query: string) => void;
  onRungClick: (rung: RecoveryRung) => void;
  formatCurrency: (amount: number, currency: string) => string;
  onOrderClick: (item: InventoryItem) => void;
  onAddToCart: (item: InventoryItem) => void;
}

export const EmptySearchRecovery: React.FC<EmptySearchRecoveryProps> = ({
  recovery,
  originalQuery,
  onSearchOriginal,
  onRemoveFilter,
  onBrowseCategory,
  onAskRenda,
  onRungClick,
  formatCurrency,
  onOrderClick,
  onAddToCart,
}) => {
  const { t } = useTranslation();
  const getFilterLabel = useCallback(
    (filter: RecoveryFilterRemoval['filter']): string => {
      return t(`search.filterLabels.${filter}`, filter);
    },
    [t]
  );

  const renderR1 = () => {
    if (!recovery.corrected_query) return null;

    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <span dangerouslySetInnerHTML={{ 
            __html: t('search.showingResultsFor', { 
              corrected: recovery.corrected_query 
            }).replace('**', '<strong>').replace('**', '</strong>')
          }} />
        </Typography>
        <MuiLink
          component="button"
          variant="body2"
          onClick={() => {
            onRungClick('R1');
            onSearchOriginal();
          }}
          sx={{ cursor: 'pointer', textDecoration: 'underline' }}
        >
          {t('search.searchInsteadFor', { original: originalQuery })}
        </MuiLink>
      </Box>
    );
  };

  const renderR2 = () => {
    if (recovery.relax.length === 0) return null;

    return (
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {recovery.relax.map((removal) => (
            <Chip
              key={removal.filter}
              label={t('search.removeFilter', {
                filter: getFilterLabel(removal.filter),
                n: removal.count,
              })}
              onClick={() => {
                onRungClick('R2');
                onRemoveFilter(removal.filter);
              }}
              variant="outlined"
              clickable
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
      </Box>
    );
  };

  const renderR3 = () => {
    if (recovery.similar.length === 0) return null;

    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t('search.similarTo', { query: recovery.query })}
        </Typography>
        <Grid container spacing={3}>
          {recovery.similar.slice(0, 6).map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <DashboardItemCard
                item={item}
                formatCurrency={formatCurrency}
                onOrderClick={() => {
                  onRungClick('R3');
                  onOrderClick(item);
                }}
                onAddToCart={() => {
                  onRungClick('R3');
                  onAddToCart(item);
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  const renderR4 = () => {
    return (
      <Box sx={{ mb: 4 }}>
        {recovery.categories.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {recovery.categories.map((category) => (
                <Chip
                  key={category.id ?? category.name}
                  label={t('search.browseCategory', { category: category.name })}
                  onClick={() => {
                    onRungClick('R4');
                    onBrowseCategory(category.id, category.name);
                  }}
                  variant="outlined"
                  clickable
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {recovery.popular_near_you.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('search.popularNearYou', 'Popular near you')}
            </Typography>
            <Grid container spacing={3}>
              {recovery.popular_near_you.slice(0, 6).map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item.id}>
                  <DashboardItemCard
                    item={item}
                    formatCurrency={formatCurrency}
                    onOrderClick={() => {
                      onRungClick('R4');
                      onOrderClick(item);
                    }}
                    onAddToCart={() => {
                      onRungClick('R4');
                      onAddToCart(item);
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    );
  };

  const renderR5 = () => {
    if (!recovery.ask_renda.enabled) return null;

    return (
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            onRungClick('R5');
            onAskRenda(recovery.ask_renda.query);
          }}
          size="large"
        >
          {t('search.askRenda', 'Ask Renda to find it')}
        </Button>
      </Box>
    );
  };

  return (
    <Box sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ p: 4, backgroundColor: 'background.default' }}>
        <Typography variant="h5" gutterBottom align="center">
          {t('search.emptyTitle', { query: recovery.query })}
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          {t('search.emptySubtitle', 'Try these instead')}
        </Typography>

        {renderR1()}
        {renderR2()}
        {renderR3()}
        {renderR4()}
        {renderR5()}
      </Paper>
    </Box>
  );
};

export default EmptySearchRecovery;
