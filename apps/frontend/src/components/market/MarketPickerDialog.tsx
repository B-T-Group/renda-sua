import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketPickerCounts } from '../../hooks/useMarketPickerCounts';
import { brandTokens } from '../../theme/brandTokens';
import type { Market, MarketStatesCatalog } from '../../types/market';
import type { BrowseLaneId } from '../../utils/browseMarketLanes';
import { formatMarketCount } from '../../utils/formatMarketCount';
import { laneIcon, MarketCountsStrip, type MarketCountLane } from './MarketCountsStrip';

export interface MarketPickerDialogProps {
  open: boolean;
  markets: Market[];
  selectedCode: string;
  selectedStateCode: string | null;
  /** Used to derive `lane` when it is not passed. */
  catalogContext?: MarketStatesCatalog;
  /**
   * Browse lane the user is in: highlights its strip cell and picks the single count on
   * rows (rentals in the Rentals lane, shop items otherwise). `null` highlights nothing.
   */
  lane?: BrowseLaneId | null;
  onSelect: (countryCode: string, stateCode: string | null) => void;
  onClose: () => void;
}

export function MarketPickerDialog({
  open,
  markets,
  selectedCode,
  selectedStateCode,
  catalogContext = 'inventory',
  lane,
  onSelect,
  onClose,
}: MarketPickerDialogProps) {
  const { t, i18n } = useTranslation();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(
    selectedCode
  );
  // One load per opened country (shop + rentals from market-states catalog=all, plus the
  // exports-into-market total). Switching lanes while open only changes the highlight.
  const { counts, totals, states, loading, statesFailed } = useMarketPickerCounts(
    expandedCountry,
    open && !!expandedCountry
  );

  const handleCountryClick = useCallback((code: string) => {
    setExpandedCountry((prev) => (prev === code ? null : code));
  }, []);

  const activeLane: BrowseLaneId | null =
    lane !== undefined
      ? lane
      : catalogContext === 'rentals'
        ? 'rentals'
        : catalogContext === 'inventory'
          ? 'shop'
          : null;
  // Food has no count of its own: no cell is highlighted.
  const highlightedLane: MarketCountLane | null =
    activeLane === 'rentals' || activeLane === 'exports' || activeLane === 'shop'
      ? activeLane
      : null;
  // Rows show one number: rentals in the Rentals lane, shop items everywhere else.
  const rowKind: 'rentals' | 'shop' = activeLane === 'rentals' ? 'rentals' : 'shop';
  const rowTone = activeLane === 'rentals' || activeLane === 'shop' ? 'lane' : 'neutral';
  const toneColor =
    rowTone === 'lane' ? brandTokens.primary.main : brandTokens.text.secondary;

  const renderCount = (value: number | null, isLoading: boolean) => {
    if (isLoading) {
      return <Skeleton variant="rounded" width={28} height={14} />;
    }
    if (value === null) return null;
    return (
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: toneColor }}
      >
        {laneIcon(rowKind, 15, toneColor)}
        <Typography
          variant="caption"
          sx={{ color: toneColor, fontWeight: rowTone === 'lane' ? 700 : 400 }}
        >
          {formatMarketCount(value, i18n.language)}
        </Typography>
      </Box>
    );
  };

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
                    {/* Hidden when a count call failed: the row then looks like today. */}
                    {(loading || counts) && (
                      <MarketCountsStrip
                        counts={counts}
                        loading={loading}
                        activeLane={highlightedLane}
                      />
                    )}
                    {/* "All of X" stays selectable while counts load. */}
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
                      {renderCount(
                        totals ? (rowKind === 'rentals' ? totals.rentals : totals.shop) : null,
                        loading
                      )}
                    </ListItemButton>
                    {!statesFailed &&
                      states.map((s) => (
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
                          {renderCount(
                            rowKind === 'rentals' ? s.rentalCount : s.inventoryCount,
                            false
                          )}
                        </ListItemButton>
                      ))}
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
