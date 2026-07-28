import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '../../hooks/useMarket';
import type { MarketStatesCatalog } from '../../hooks/useMarketStates';
import { MarketPickerDialog } from './MarketPickerDialog';

export interface MarketSelectorProps {
  catalogContext?: MarketStatesCatalog;
}

export function MarketSelector({ catalogContext = 'inventory' }: MarketSelectorProps) {
  const { t } = useTranslation();
  const { selectedMarket, markets, setMarket } = useMarket();
  const [open, setOpen] = useState(false);

  if (!selectedMarket) return null;

  const stateLabel = selectedMarket.stateCode
    ? selectedMarket.stateName ?? selectedMarket.stateCode
    : t('market.selector.allStates', 'All');

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={() => setOpen(true)}
        sx={{
          borderRadius: 999,
          textTransform: 'none',
          fontWeight: 600,
          maxWidth: '100%',
        }}
      >
        <Box component="span" sx={{ mr: 0.75 }}>
          {selectedMarket.flag}
        </Box>
        <Typography component="span" variant="body2" noWrap>
          {selectedMarket.name}
          <Typography component="span" color="text.secondary">
            {' · '}
            {stateLabel}
          </Typography>
        </Typography>
      </Button>
      <MarketPickerDialog
        open={open}
        markets={markets}
        selectedCode={selectedMarket.countryCode}
        selectedStateCode={selectedMarket.stateCode}
        catalogContext={catalogContext}
        onSelect={setMarket}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
