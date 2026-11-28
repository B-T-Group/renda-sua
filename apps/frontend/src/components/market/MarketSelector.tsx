import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '../../hooks/useMarket';
import {
  formatMarketCaption,
  MARKET_CAPTION_SEPARATOR,
  type MarketStatesCatalog,
} from '../../types/market';
import type { BrowseLaneId } from '../../utils/browseMarketLanes';
import { MarketPickerDialog } from './MarketPickerDialog';

export interface MarketSelectorProps {
  catalogContext?: MarketStatesCatalog;
  /** Browse lane the user is in (highlights its count in the picker). */
  lane?: BrowseLaneId | null;
  inverted?: boolean;
  compact?: boolean;
  onSelected?: () => void;
}

export function MarketSelector({
  catalogContext = 'inventory',
  lane,
  inverted = false,
  compact = false,
  onSelected,
}: MarketSelectorProps) {
  const { t } = useTranslation();
  const { selectedMarket, markets, setMarket } = useMarket();
  const [open, setOpen] = useState(false);

  if (!selectedMarket) return null;

  const stateLabel = selectedMarket.stateCode
    ? selectedMarket.stateName ?? selectedMarket.stateCode
    : t('market.selector.allStates', 'All');
  const primaryLabel = compact
    ? selectedMarket.countryCode
    : selectedMarket.name;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        color="inherit"
        onClick={() => setOpen(true)}
        aria-label={t('market.selector.label', 'Selected market: {{name}}', {
          name: formatMarketCaption(selectedMarket.name, stateLabel),
        })}
        sx={{
          borderRadius: 999,
          textTransform: 'none',
          fontWeight: 600,
          maxWidth: compact ? 132 : 240,
          minWidth: 0,
          px: compact ? 1.25 : 2,
          py: 0.5,
          color: inverted ? '#ffffff' : 'text.primary',
          borderColor: inverted ? 'rgba(255, 255, 255, 0.55)' : 'divider',
          '&:hover': {
            borderColor: inverted ? '#ffffff' : 'text.primary',
            backgroundColor: inverted
              ? 'rgba(255, 255, 255, 0.08)'
              : 'action.hover',
          },
        }}
      >
        <Box component="span" sx={{ mr: 0.75, lineHeight: 1 }}>
          {selectedMarket.flag}
        </Box>
        <Typography
          component="span"
          variant="body2"
          noWrap
          color="inherit"
          sx={{ fontWeight: 600 }}
        >
          {primaryLabel}
          {!compact && (
            <Box component="span" sx={{ fontWeight: 500, opacity: inverted ? 1 : 0.85 }}>
              {` ${MARKET_CAPTION_SEPARATOR} ${stateLabel}`}
            </Box>
          )}
        </Typography>
        <ExpandMoreIcon
          sx={{ ml: 0.25, fontSize: 18, color: 'inherit', opacity: 0.9 }}
        />
      </Button>
      <MarketPickerDialog
        open={open}
        markets={markets}
        selectedCode={selectedMarket.countryCode}
        selectedStateCode={selectedMarket.stateCode}
        catalogContext={catalogContext}
        lane={lane}
        onSelect={(countryCode, stateCode) => {
          setMarket(countryCode, stateCode);
          onSelected?.();
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
