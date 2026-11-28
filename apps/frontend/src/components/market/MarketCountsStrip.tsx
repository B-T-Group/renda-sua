import { Box, Skeleton, Typography } from '@mui/material';
import { cloneElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketLaneCounts } from '../../hooks/useMarketPickerCounts';
import { brandTokens } from '../../theme/brandTokens';
import { BROWSE_LANES, type BrowseLaneId } from '../../utils/browseMarketLanes';
import {
  formatMarketCount,
  formatMarketCountExact,
} from '../../utils/formatMarketCount';

export type MarketCountLane = keyof MarketLaneCounts;

/** Lane order matches the lane switcher: Rentals, Exports, Shop. */
export const MARKET_COUNT_LANES: MarketCountLane[] = ['rentals', 'exports', 'shop'];

const A11Y_KEYS: Record<MarketCountLane, string> = {
  rentals: 'market.picker.a11y.rentals',
  exports: 'market.picker.a11y.exports',
  shop: 'market.picker.a11y.items',
};

const A11Y_DEFAULTS: Record<MarketCountLane, { one: string; other: string }> = {
  rentals: { one: '{{formatted}} rental', other: '{{formatted}} rentals' },
  exports: { one: '{{formatted}} export', other: '{{formatted}} exports' },
  shop: { one: '{{formatted}} item', other: '{{formatted}} items' },
};

export function laneIcon(lane: BrowseLaneId, fontSize: number, color?: string) {
  const entry = BROWSE_LANES.find((l) => l.key === lane);
  return entry
    ? cloneElement(entry.icon, { sx: { fontSize, ...(color ? { color } : {}) } })
    : null;
}

export interface MarketCountsStripProps {
  /** null while loading (numbers shimmer). */
  counts: MarketLaneCounts | null;
  loading: boolean;
  /** Lane the user is in; null (Food, non-lane pages) highlights nothing. */
  activeLane: MarketCountLane | null;
}

/**
 * Three-cell strip above "All of X" inside an opened market: icon, number and a small
 * label per lane. The active lane is filled light blue and bold; a zero stays visible but
 * muted so the strip always has three cells. The caller hides it when a count call failed.
 */
export function MarketCountsStrip({ counts, loading, activeLane }: MarketCountsStripProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const laneLabel = (lane: MarketCountLane) =>
    t(`client.home.lane.${lane}`, lane.charAt(0).toUpperCase() + lane.slice(1));

  return (
    <Box
      data-testid="market-counts-strip"
      sx={{ display: 'flex', gap: 0.75, px: 3, pt: 0.5, pb: 1 }}
    >
      {MARKET_COUNT_LANES.map((lane) => {
        const label = laneLabel(lane);
        const value = counts?.[lane] ?? 0;
        const active = activeLane === lane;
        const zero = !loading && value === 0;
        const accent = active
          ? brandTokens.primary.main
          : zero
            ? brandTokens.text.muted
            : brandTokens.text.primary;
        const a11yLabel = loading
          ? label
          : t(A11Y_KEYS[lane], {
              count: value,
              formatted: formatMarketCountExact(value, language),
              defaultValue_one: A11Y_DEFAULTS[lane].one,
              defaultValue_other: A11Y_DEFAULTS[lane].other,
            });
        return (
          <Box
            key={lane}
            role="img"
            aria-label={a11yLabel}
            aria-current={active ? 'true' : undefined}
            data-testid={`market-count-${lane}`}
            data-active={active ? 'true' : 'false'}
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.125,
              py: 0.75,
              px: 0.25,
              borderRadius: 1.5,
              bgcolor: active ? brandTokens.tint.primary : brandTokens.surface.subtle,
            }}
          >
            {laneIcon(
              lane,
              18,
              active
                ? brandTokens.primary.main
                : zero
                  ? '#94A3B8'
                  : brandTokens.text.muted
            )}
            {loading ? (
              <Skeleton variant="rounded" width={30} height={14} sx={{ my: '3px' }} />
            ) : (
              <Typography
                component="span"
                noWrap
                aria-hidden
                sx={{
                  fontSize: 15,
                  lineHeight: '20px',
                  fontWeight: active ? 700 : 500,
                  color: accent,
                  maxWidth: '100%',
                }}
              >
                {formatMarketCount(value, language)}
              </Typography>
            )}
            <Typography
              component="span"
              noWrap
              aria-hidden
              sx={{
                fontSize: 10.5,
                lineHeight: '13px',
                fontWeight: active ? 700 : 400,
                color: active ? brandTokens.primary.main : brandTokens.text.muted,
                maxWidth: '100%',
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
