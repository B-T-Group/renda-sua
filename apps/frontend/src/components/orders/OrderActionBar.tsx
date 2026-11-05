import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RankedOrderActions } from '../../utils/rankOrderDetailActions';

export type OrderActionBarHandler = {
  id: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Custom node instead of a contained Button (e.g. PIN control). */
  render?: () => React.ReactNode;
};

export type OrderActionBarProps = {
  ranked: RankedOrderActions;
  handlers: Record<string, OrderActionBarHandler>;
  /** Override primary label (e.g. pay amount). */
  primaryLabel?: string;
  accentPrimary?: boolean;
  /** Extra bottom offset for app tab bars on mobile web. */
  bottomOffset?: number;
  /** Skip fixed positioning when parent already provides a sticky shell. */
  plain?: boolean;
};

/**
 * Sticky order-detail action bar: one primary, optional companion, More overflow.
 */
export function OrderActionBar({
  ranked,
  handlers,
  primaryLabel,
  accentPrimary,
  bottomOffset = 0,
  plain,
}: OrderActionBarProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { primary, companion, overflow } = ranked;

  if (!primary && overflow.length === 0 && !companion) {
    return null;
  }

  const primaryHandler = primary ? handlers[primary.id] : undefined;
  const companionHandler = companion ? handlers[companion.id] : undefined;

  return (
    <Box
      sx={
        plain
          ? {
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              width: '100%',
            }
          : {
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: bottomOffset,
              zIndex: 1100,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              boxShadow: 3,
              px: 2,
              py: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              maxWidth: 720,
              mx: 'auto',
              width: '100%',
            }
      }
    >
      {primaryHandler?.render ? (
        primaryHandler.render()
      ) : primary && primaryHandler ? (
        <Button
          fullWidth
          variant="contained"
          color={accentPrimary ? 'cta' : 'primary'}
          onClick={primaryHandler.onClick}
          disabled={primaryHandler.disabled || primaryHandler.loading}
          startIcon={
            primaryHandler.loading ? <CircularProgress size={16} /> : undefined
          }
        >
          {primaryLabel ?? t(primary.labelKey, primary.defaultLabel)}
        </Button>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          justifyContent: companion || overflow.length ? 'space-between' : 'flex-end',
        }}
      >
        {companion && companionHandler ? (
          <Button
            variant="text"
            color={companion.destructive ? 'error' : 'inherit'}
            onClick={companionHandler.onClick}
            disabled={companionHandler.disabled || companionHandler.loading}
            sx={{ flex: 1 }}
          >
            {t(companion.labelKey, companion.defaultLabel)}
          </Button>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}

        {overflow.length > 0 ? (
          <>
            <IconButton
              aria-label={t('orders.actionBar.more', 'More actions')}
              onClick={(e) => setAnchor(e.currentTarget)}
              size="small"
            >
              <MoreHorizIcon />
            </IconButton>
            <Menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              {overflow.map((item) => {
                const handler = handlers[item.id];
                if (!handler) return null;
                return (
                  <MenuItem
                    key={item.id}
                    onClick={() => {
                      setAnchor(null);
                      handler.onClick();
                    }}
                    disabled={handler.disabled || handler.loading}
                    sx={
                      item.destructive
                        ? { color: 'error.main' }
                        : undefined
                    }
                  >
                    {handler.loading ? (
                      <ListItemIcon>
                        <CircularProgress size={16} />
                      </ListItemIcon>
                    ) : null}
                    <ListItemText>
                      {t(item.labelKey, item.defaultLabel)}
                    </ListItemText>
                  </MenuItem>
                );
              })}
            </Menu>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
