import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketStates, type MarketStatesCatalog } from '../../hooks/useMarketStates';
import type { Market } from '../../types/market';

export interface MarketPickerDialogProps {
  open: boolean;
  markets: Market[];
  selectedCode: string;
  selectedStateCode: string | null;
  catalogContext?: MarketStatesCatalog;
  onSelect: (countryCode: string, stateCode: string | null) => void;
  onClose: () => void;
}

export function MarketPickerDialog({
  open,
  markets,
  selectedCode,
  selectedStateCode,
  catalogContext = 'inventory',
  onSelect,
  onClose,
}: MarketPickerDialogProps) {
  const { t } = useTranslation();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(
    selectedCode
  );
  const { states, totalItemCount, loading } = useMarketStates(
    expandedCountry,
    open && !!expandedCountry,
    catalogContext
  );

  const handleCountryClick = useCallback((code: string) => {
    setExpandedCountry((prev) => (prev === code ? null : code));
  }, []);

  const countSuffix =
    catalogContext === 'rentals'
      ? t('market.picker.rentalsShort', 'rentals')
      : t('market.picker.itemsShort', 'items');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        {t('market.picker.title', 'Select marketplace')}
        <IconButton
          aria-label={t('common.close', 'Close')}
          onClick={onClose}
          sx={{ ml: 'auto' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {markets.map((market) => {
            const expanded = expandedCountry === market.countryCode;
            const countrySelected =
              market.countryCode === selectedCode && selectedStateCode === null;
            return (
              <Box key={market.id}>
                <ListItemButton
                  onClick={() => handleCountryClick(market.countryCode)}
                  selected={countrySelected}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{market.flag}</span>
                        <span>{market.name}</span>
                      </Box>
                    }
                    secondary={market.currency}
                  />
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>
                {expanded ? (
                  <Box sx={{ pl: 2, pb: 1 }}>
                    {loading ? (
                      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={22} />
                      </Box>
                    ) : (
                      <>
                        <ListItemButton
                          selected={
                            market.countryCode === selectedCode &&
                            selectedStateCode === null
                          }
                          onClick={() => {
                            onSelect(market.countryCode, null);
                            onClose();
                          }}
                          sx={{ pl: 3 }}
                        >
                          <ListItemText
                            primary={t('market.picker.allStates', 'All of {{name}}', {
                              name: market.name,
                            })}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {totalItemCount} {countSuffix}
                          </Typography>
                        </ListItemButton>
                        {states.map((s) => (
                          <ListItemButton
                            key={s.state}
                            selected={
                              market.countryCode === selectedCode &&
                              selectedStateCode === s.state
                            }
                            onClick={() => {
                              onSelect(market.countryCode, s.state);
                              onClose();
                            }}
                            sx={{ pl: 3 }}
                          >
                            <ListItemText primary={s.state} />
                            <Typography variant="caption" color="text.secondary">
                              {s.itemCount}
                            </Typography>
                          </ListItemButton>
                        ))}
                      </>
                    )}
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
