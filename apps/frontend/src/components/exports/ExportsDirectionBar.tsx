import {
  Check,
  ExpandMore,
  FlightLand,
  FlightTakeoff,
  Link as LinkIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ExportOriginSummary } from '../../hooks/useExportOrigins';
import { useMarket } from '../../hooks/useMarket';
import { exportCountryName, exportCountryPlace } from '../../utils/exportCountries';
import { exportsOriginPath, exportsShareUrl } from '../../utils/exportsPublicLink';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';

interface ExportsDirectionBarProps {
  direction: 'into' | 'from';
  /** Origin shown in the From view (defaults to the viewer market). */
  originCode?: string | null;
  origins: ExportOriginSummary[];
}

function CodeTag({ code, inverted }: { code: string; inverted?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: 11,
        fontWeight: 700,
        px: 0.5,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: inverted ? 'rgba(255,255,255,0.6)' : '#C8D1DD',
        color: inverted ? '#fff' : 'text.secondary',
        lineHeight: 1.5,
      }}
    >
      {code}
    </Box>
  );
}

/**
 * "Into {market}" / "From {country}" switch, the origin picker and Copy link (AC1, AC2, AC4).
 * Choosing an origin navigates to /exports/{cc}; it never changes the shopping market.
 */
export const ExportsDirectionBar: React.FC<ExportsDirectionBarProps> = ({
  direction,
  originCode,
  origins,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedMarket } = useMarket();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const lang = i18n.language;
  const market = selectedMarket?.countryCode?.toUpperCase() ?? null;
  const origin = (originCode ?? market)?.toUpperCase() ?? null;

  const copyLink = async () => {
    if (!origin) return;
    try {
      await navigator.clipboard.writeText(exportsShareUrl(origin));
      enqueueSnackbar(t('exportsOrigin.linkCopied', 'Link copied'), { variant: 'success' });
    } catch {
      enqueueSnackbar(exportsShareUrl(origin), { variant: 'info' });
    }
  };

  const selectedSx = {
    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: EXPORT_BRAND_BLUE, color: '#fff' },
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', sm: 'flex-end' }, gap: 1 }}
      data-testid="exports-direction-bar"
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={direction}
        aria-label={t('exportsOrigin.switchLabel', 'Export direction')}
        onChange={(_, next: 'into' | 'from' | null) => {
          if (!next || next === direction) return;
          if (next === 'into') navigate('/exports');
          else if (origin) navigate(exportsOriginPath(origin));
        }}
        sx={{ bgcolor: '#fff', borderRadius: 5, p: 0.25, border: '1px solid #D5DCE6', alignSelf: { xs: 'stretch', sm: 'auto' } }}
      >
        <ToggleButton
          value="into"
          data-testid="exports-into"
          sx={{ border: 0, borderRadius: '20px !important', px: 2, textTransform: 'none', fontWeight: 600, gap: 0.75, flex: 1, ...selectedSx }}
        >
          <FlightLand fontSize="small" />
          {market
            ? t('exportsOrigin.into', 'Into {{place}}', { place: exportCountryPlace(market, lang) })
            : t('exportsOrigin.intoMyMarket', 'Into my market')}
        </ToggleButton>
        <ToggleButton
          value="from"
          data-testid="exports-from"
          sx={{ border: 0, borderRadius: '20px !important', px: 2, textTransform: 'none', fontWeight: 600, gap: 0.75, flex: 1, ...selectedSx }}
        >
          <FlightTakeoff fontSize="small" />
          {origin
            ? t('exportsOrigin.from', 'From {{place}}', { place: exportCountryPlace(origin, lang) })
            : t('exportsOrigin.fromCountry', 'From a country')}
        </ToggleButton>
      </ToggleButtonGroup>

      {direction === 'from' && origin ? (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
          <Button
            variant="outlined"
            size="small"
            data-testid="exports-origin-picker"
            startIcon={<FlightTakeoff />}
            endIcon={<ExpandMore />}
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-haspopup="menu"
            sx={{ borderRadius: 5, textTransform: 'none', fontWeight: 700, bgcolor: '#EAF1FB', borderColor: EXPORT_BRAND_BLUE, color: EXPORT_BRAND_BLUE, gap: 0.5 }}
          >
            <CodeTag code={origin} />
            <Box component="span" sx={{ ml: 0.75 }}>
              {exportCountryName(origin, lang)}
            </Box>
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LinkIcon />}
            onClick={() => void copyLink()}
            data-testid="exports-copy-link"
            sx={{ borderRadius: 5, textTransform: 'none', fontWeight: 700, borderColor: EXPORT_BRAND_BLUE, color: EXPORT_BRAND_BLUE }}
          >
            {t('exportsOrigin.copyLink', 'Copy link')}
          </Button>
        </Box>
      ) : null}

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 300 } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            {t('exportsOrigin.pickerTitle', 'Exported from')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {market
              ? t('exportsOrigin.pickerHelp', 'See what each market exports. Your market stays {{place}}.', {
                  place: exportCountryPlace(market, lang),
                })
              : t('exportsOrigin.pickerHelpNoMarket', 'See what each market exports.')}
          </Typography>
        </Box>
        {origins.map((row) => {
          const selected = row.country_code === origin;
          return (
            <MenuItem
              key={row.country_code}
              selected={selected}
              onClick={() => {
                setAnchor(null);
                navigate(exportsOriginPath(row.country_code));
              }}
              data-testid={`exports-origin-option-${row.country_code}`}
            >
              <ListItemIcon>
                <CodeTag code={row.country_code} />
              </ListItemIcon>
              <ListItemText
                primary={exportCountryName(row.country_code, lang)}
                primaryTypographyProps={{ fontWeight: selected ? 700 : 500, color: selected ? EXPORT_BRAND_BLUE : 'text.primary' }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {t('exportsOrigin.itemsCount', { count: row.item_count, defaultValue: '{{count}} items' })}
              </Typography>
              {selected ? <Check fontSize="small" sx={{ ml: 1, color: EXPORT_BRAND_BLUE }} /> : <Box sx={{ width: 28 }} />}
            </MenuItem>
          );
        })}
        {origins.length === 0 ? (
          <MenuItem disabled>{t('exportsOrigin.noOrigins', 'No exports yet')}</MenuItem>
        ) : null}
      </Menu>
    </Box>
  );
};

export default ExportsDirectionBar;
