import ShoppingCart from '@mui/icons-material/ShoppingCart';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import {
  alertStateFromResult,
  useRestockAlertsApi,
} from '../../hooks/useRestockAlerts';
import type { ItemAlertState } from '../../hooks/useRestockAlerts';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import { orderedItemImages } from '../../utils/orderedItemImages';
import { RestockAlertBellButton } from './RestockAlertBellButton';

const MAX_LIKES_PAGES = 6;

interface RestockAlertPdpSectionProps {
  inventoryItem: InventoryItem;
  /** Current heart state of the PDP (shared with the like button). */
  liked: boolean;
  /** Called after the bell liked the item so the heart can update. */
  onLiked: () => void;
  /** True when the URL has `?src=restock_alert`. */
  fromAlert: boolean;
  /** In-stock similar listings (already filtered), shown with the "Gone again" banner. */
  similarInStock: InventoryItem[];
  formatCurrency: (amount: number, currency?: string) => string;
}

/**
 * Sold-out PDP (flag on, signed-in client): disabled Add to cart with the restock bell
 * beside it, plus the "Gone again" banner and 2-3 similar in-stock items when the
 * visitor arrived from a restock alert (`?src=restock_alert`).
 */
export const RestockAlertPdpSection: React.FC<RestockAlertPdpSectionProps> = ({
  inventoryItem,
  liked,
  onLiked,
  fromAlert,
  similarInStock,
  formatCurrency,
}) => {
  const { t } = useTranslation();
  const { getLikes, setItemAlert, likeItem } = useRestockAlertsApi();
  const catalogItemId = inventoryItem.item_id || inventoryItem.item?.id;
  const itemName = inventoryItem.item?.name || '';

  const [alertState, setAlertState] = useState<ItemAlertState | null>(null);

  // Load the bell state: unliked = quiet "off"; liked = read it from the likes list.
  useEffect(() => {
    if (!catalogItemId) return undefined;
    if (!liked) {
      setAlertState({ state: 'off', enabled: false, expires_at: null });
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        for (let page = 1; page <= MAX_LIKES_PAGES; page += 1) {
          const res = await getLikes('all', page, 50);
          const hit = res.items.find(
            (it: any) => (it.item_id || it.item?.id) === catalogItemId
          );
          if (hit?.restock_alert) {
            if (!cancelled) {
              setAlertState(
                hit.restock_alert.state === null
                  ? { state: 'off', enabled: false, expires_at: null }
                  : hit.restock_alert
              );
            }
            return;
          }
          if (page >= res.totalPages) break;
        }
        if (!cancelled) setAlertState(null);
      } catch {
        if (!cancelled) setAlertState(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemId, liked]);

  const handleTurnOn = async (): Promise<ItemAlertState | null> => {
    if (!catalogItemId) return null;
    if (!liked) {
      // Spec §1: the alert is the result of a like. Like first, then arm.
      await likeItem(catalogItemId);
      onLiked();
    }
    return alertStateFromResult(await setItemAlert(catalogItemId, true));
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {fromAlert ? (
        <Alert severity="info">
          {t(
            'restock.goneAgainBanner',
            "Gone again. We'll tell you next time."
          )}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="outlined"
          color="primary"
          startIcon={<ShoppingCart />}
          disabled
          fullWidth
          sx={{ minHeight: 48 }}
        >
          {t('cart.addToCart', 'Add to Cart')}
        </Button>
        {catalogItemId && alertState ? (
          <RestockAlertBellButton
            itemId={catalogItemId}
            itemName={itemName}
            alertState={alertState}
            onAlertChange={setAlertState}
            onTurnOn={handleTurnOn}
          />
        ) : null}
      </Stack>

      {fromAlert ? (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('items.similarItems', 'Similar Items')}
          </Typography>
          {similarInStock.length > 0 ? (
            <Grid container spacing={1.5}>
              {similarInStock.slice(0, 3).map((sim) => (
                <Grid size={{ xs: 4 }} key={sim.id}>
                  <Card
                    component={RouterLink}
                    to={`/items/${sim.id}`}
                    sx={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      height: '100%',
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="90"
                      image={
                        orderedItemImages(sim.item?.item_images)[0]?.image_url ||
                        NoImage
                      }
                      alt={sim.item?.name}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="caption" component="div" noWrap>
                        {sim.item?.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="primary"
                        fontWeight={600}
                      >
                        {formatCurrency(
                          sim.hasActiveDeal &&
                            typeof sim.discounted_price === 'number'
                            ? sim.discounted_price
                            : sim.selling_price,
                          sim.item?.currency
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Button component={RouterLink} to="/items" variant="outlined" size="small">
              {t('items.likes.browseCta', 'Browse items')}
            </Button>
          )}
        </Box>
      ) : null}
    </Stack>
  );
};
