import {
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useApiClient } from '../../../../hooks/useApiClient';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useBusinessLocations } from '../../../../hooks/useBusinessLocations';
import { useItems } from '../../../../hooks/useItems';
import { trackProductCreateEvent } from '../../../../utils/productCreateAnalytics';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';
import type { ReviewFormValues } from './FirstSaleItemReviewStep';

export interface FirstSaleItemPublishStepProps {
  itemId: string;
  imageIds: string[];
  form: ReviewFormValues;
  merchantHint: string;
  qualityScore?: number;
  initialLocationId?: string;
  onComplete: (
    summary: CreatedSaleItemSummary,
    savedAsDraft: boolean,
    locationName?: string
  ) => void;
}

const FirstSaleItemPublishStep: React.FC<FirstSaleItemPublishStepProps> = ({
  itemId,
  imageIds,
  form,
  merchantHint,
  qualityScore,
  initialLocationId,
  onComplete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const apiClient = useApiClient();
  const { updateItem, quickPublishItem } = useItems(profile?.business?.id, {
    skipInitialItemsFetch: true,
  });
  const { associateImageToItem } = useBusinessImages();
  const {
    locations,
    loading: locationsLoading,
    fetchLocations,
  } = useBusinessLocations(profile?.business?.id);

  const [quantity, setQuantity] = useState('1');
  const [locationId, setLocationId] = useState(initialLocationId ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.business?.id) void fetchLocations();
  }, [fetchLocations, profile?.business?.id]);

  useEffect(() => {
    if (!locations?.length) return;
    setLocationId((prev) => {
      if (prev) return prev;
      if (
        initialLocationId &&
        locations.some((l) => l.id === initialLocationId)
      ) {
        return initialLocationId;
      }
      return locations[0]?.id ?? '';
    });
  }, [initialLocationId, locations]);

  const selectedLocation = useMemo(
    () => locations?.find((l) => l.id === locationId),
    [locationId, locations]
  );

  const priceNum = Number.parseFloat(form.price);
  const canPublish =
    !!form.name.trim() &&
    !Number.isNaN(priceNum) &&
    priceNum > 0 &&
    !!locationId &&
    !busy;

  const persistAndFinish = async (asDraft: boolean) => {
    if (!canPublish && !asDraft) return;
    if (asDraft && !form.name.trim()) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        name: form.name.trim(),
        price: priceNum > 0 ? priceNum : undefined,
        currency: form.currency,
        categoryName: form.categoryName.trim() || undefined,
        subCategoryName: form.subCategoryName.trim() || undefined,
        brandName: form.brandName.trim() || undefined,
        is_used: form.isUsed,
        dimensions: form.dimensions.trim() || undefined,
      };
      if (form.description.trim()) {
        patch.description = form.description.trim();
      }
      await updateItem(itemId, patch as any);

      for (const extra of imageIds.slice(1)) {
        try {
          await associateImageToItem(extra, itemId, { skipRefetch: true });
        } catch {
          // non-fatal — may already be linked
        }
      }

      const summary: CreatedSaleItemSummary = {
        id: itemId,
        name: form.name.trim(),
        price: priceNum > 0 ? priceNum : undefined,
        currency: form.currency,
      };

      if (asDraft) {
        onComplete(summary, true, selectedLocation?.name);
        return;
      }

      await quickPublishItem(itemId, {
        locationId,
        quantity: Math.max(0, Number.parseInt(quantity, 10) || 0),
        sellingPrice: priceNum,
      });
      enqueueSnackbar(
        t(
          'business.onboarding.firstSale.review.submitted',
          'Product submitted for approval'
        ),
        { variant: 'success' }
      );
      trackProductCreateEvent(apiClient, 'product_create.published', {
        photoCount: imageIds.length,
        hintUsed: !!merchantHint.trim(),
        qualityScore,
      });
      onComplete(summary, false, selectedLocation?.name);
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.onboarding.firstSale.review.publishFailed',
            'Could not publish product'
          ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={600}>
        {t('business.onboarding.firstSale.publish.title', 'Stock & location')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.onboarding.firstSale.publish.body',
          'Choose where this product is sold and how many you have in stock.'
        )}
      </Typography>

      <TextField
        label={t('business.onboarding.firstSale.location.quantity', 'Quantity')}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        type="number"
        fullWidth
      />
      <FormControl fullWidth disabled={locationsLoading}>
        <InputLabel>
          {t('business.onboarding.firstSale.location.select', 'Location')}
        </InputLabel>
        <Select
          label={t('business.onboarding.firstSale.location.select', 'Location')}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {(locations ?? []).map((loc) => (
            <MenuItem key={loc.id} value={loc.id}>
              {loc.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button variant="outlined" onClick={() => navigate('/business/locations')}>
        {t('business.onboarding.firstSale.location.addLocation', 'New location')}
      </Button>

      <Stack spacing={1} sx={{ pt: 1 }}>
        <Button
          variant="contained"
          size="large"
          disabled={!canPublish}
          onClick={() => void persistAndFinish(false)}
          fullWidth={isNarrow}
          sx={{ minHeight: 48 }}
          startIcon={
            busy ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {t('business.onboarding.firstSale.review.publish', 'Publish product')}
        </Button>
        <Button
          variant="text"
          disabled={busy || !form.name.trim()}
          onClick={() => void persistAndFinish(true)}
          fullWidth={isNarrow}
        >
          {t('business.onboarding.firstSale.review.finishLater', 'Finish later')}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemPublishStep;
