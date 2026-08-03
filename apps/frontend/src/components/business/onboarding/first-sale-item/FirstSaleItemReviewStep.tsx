import {
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useBusinessLocations } from '../../../../hooks/useBusinessLocations';
import { useBusinessLockedCurrency } from '../../../../hooks/useBusinessLockedCurrency';
import { useCreateItemFromImage } from '../../../../hooks/useCreateItemFromImage';
import { useImageItemSuggestions } from '../../../../hooks/useImageItemSuggestions';
import { useApiClient } from '../../../../hooks/useApiClient';
import { useItems } from '../../../../hooks/useItems';
import { trackProductCreateEvent } from '../../../../utils/productCreateAnalytics';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';

export interface FirstSaleItemReviewStepProps {
  imageIds: string[];
  imagePreviewUrls: string[];
  merchantHint?: string;
  initialLocationId?: string;
  onComplete: (summary: CreatedSaleItemSummary, savedAsDraft: boolean, locationName?: string) => void;
}

const FirstSaleItemReviewStep: React.FC<FirstSaleItemReviewStepProps> = ({
  imageIds,
  imagePreviewUrls,
  merchantHint = '',
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
  const { lockedCurrency } = useBusinessLockedCurrency(profile?.business?.id);
  const { createItemFromImage, loading: creating } = useCreateItemFromImage();
  const { updateItem, quickPublishItem } = useItems(profile?.business?.id, {
    skipInitialItemsFetch: true,
  });
  const { associateImageToItem } = useBusinessImages();
  const {
    locations,
    loading: locationsLoading,
    fetchLocations,
  } = useBusinessLocations(profile?.business?.id);

  useEffect(() => {
    if (profile?.business?.id) {
      void fetchLocations();
    }
  }, [fetchLocations, profile?.business?.id]);

  const [hint, setHint] = useState(merchantHint);
  const [aiTrigger, setAiTrigger] = useState(1);
  const { suggestions, loading: aiLoading, error: aiError, refetch } =
    useImageItemSuggestions(imageIds, {
      autoWhen: true,
      trigger: aiTrigger,
      hint,
    });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [locationId, setLocationId] = useState(initialLocationId ?? '');
  const [itemId, setItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filledRef = useRef(false);
  const draftPromiseRef = useRef<Promise<string | null> | null>(null);
  const itemIdRef = useRef<string | null>(null);

  useEffect(() => {
    itemIdRef.current = itemId;
  }, [itemId]);

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

  useEffect(() => {
    if (!suggestions || filledRef.current) return;
    filledRef.current = true;
    setName((v) => v || suggestions.name?.trim() || '');
    setDescription(
      (v) => v || suggestions.descriptionSuggestion?.trim() || ''
    );
    setCategoryName((v) => v || suggestions.categoryName?.trim() || '');
    setSubCategoryName((v) => v || suggestions.subCategoryName?.trim() || '');
    setBrandName((v) => v || suggestions.brandName?.trim() || '');
    if (suggestions.price != null) {
      setPrice((v) => v || String(suggestions.price));
    }
  }, [suggestions]);

  const linkExtraImages = useCallback(
    async (id: string) => {
      for (const extra of imageIds.slice(1)) {
        try {
          await associateImageToItem(extra, id, { skipRefetch: true });
        } catch {
          // non-fatal
        }
      }
    },
    [associateImageToItem, imageIds]
  );

  useEffect(() => {
    if (!imageIds[0] || draftPromiseRef.current || itemIdRef.current) return;
    draftPromiseRef.current = (async () => {
      const res = await createItemFromImage({
        imageId: imageIds[0],
        name: hint.trim() || undefined,
        hint: hint.trim() || undefined,
      });
      const id = (res as { item?: { id?: string } })?.item?.id ?? null;
      if (id) {
        itemIdRef.current = id;
        setItemId(id);
        await linkExtraImages(id);
      } else {
        draftPromiseRef.current = null;
      }
      return id;
    })();
  }, [createItemFromImage, hint, imageIds, linkExtraImages]);

  const ensureDraftItemId = useCallback(async (): Promise<string | null> => {
    if (itemIdRef.current) return itemIdRef.current;
    if (draftPromiseRef.current) {
      return draftPromiseRef.current;
    }
    if (!imageIds[0]) return null;
    draftPromiseRef.current = (async () => {
      const res = await createItemFromImage({
        imageId: imageIds[0],
        name: name.trim() || hint.trim() || undefined,
        categoryName: categoryName.trim() || undefined,
        subCategoryName: subCategoryName.trim() || undefined,
        brandName: brandName.trim() || undefined,
        description: description.trim() || undefined,
        price: Number.parseFloat(price) > 0 ? Number.parseFloat(price) : undefined,
        currency: lockedCurrency || suggestions?.currency || 'XAF',
      });
      const id = (res as { item?: { id?: string } })?.item?.id ?? null;
      if (id) {
        itemIdRef.current = id;
        setItemId(id);
        await linkExtraImages(id);
      } else {
        draftPromiseRef.current = null;
      }
      return id;
    })();
    return draftPromiseRef.current;
  }, [
    brandName,
    categoryName,
    createItemFromImage,
    description,
    hint,
    imageIds,
    linkExtraImages,
    lockedCurrency,
    name,
    price,
    subCategoryName,
    suggestions?.currency,
  ]);

  const currency = lockedCurrency || suggestions?.currency || 'XAF';
  const priceNum = Number.parseFloat(price);
  const canPublish =
    !!name.trim() &&
    !Number.isNaN(priceNum) &&
    priceNum > 0 &&
    !!locationId &&
    !busy &&
    !creating;

  const quality = suggestions?.listingQuality;
  const topDuplicate = suggestions?.duplicateCandidates?.[0];

  const applyHint = useCallback(async () => {
    filledRef.current = false;
    setAiTrigger((n) => n + 1);
    const data = await refetch(hint);
    if (data) {
      setName((v) => data.name?.trim() || v);
      setDescription((v) => data.descriptionSuggestion?.trim() || v);
      setCategoryName((v) => data.categoryName?.trim() || v);
      setSubCategoryName((v) => data.subCategoryName?.trim() || v);
      setBrandName((v) => data.brandName?.trim() || v);
      if (data.price != null) {
        setPrice(String(data.price));
      }
      filledRef.current = true;
    }
  }, [hint, refetch]);

  const selectedLocation = useMemo(
    () => locations?.find((l) => l.id === locationId),
    [locationId, locations]
  );

  const publish = async (asDraft: boolean) => {
    if (!canPublish && !asDraft) return;
    setBusy(true);
    try {
      const id = await ensureDraftItemId();
      if (!id) throw new Error('Failed to create item');

      const patch: Record<string, unknown> = {
        name: name.trim(),
        price: priceNum > 0 ? priceNum : undefined,
        currency,
        categoryName: categoryName.trim() || undefined,
        subCategoryName: subCategoryName.trim() || undefined,
        brandName: brandName.trim() || undefined,
      };
      // Never overwrite a server-generated description with an empty client value.
      if (description.trim()) {
        patch.description = description.trim();
      }
      await updateItem(id, patch as any);
      await linkExtraImages(id);

      const summary: CreatedSaleItemSummary = {
        id,
        name: name.trim(),
        price: priceNum > 0 ? priceNum : undefined,
        currency,
      };

      if (asDraft) {
        onComplete(summary, true, selectedLocation?.name);
        return;
      }

      await quickPublishItem(id, {
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
        hintUsed: !!hint.trim(),
        qualityScore: quality?.score,
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
      {imagePreviewUrls[0] ? (
        <Box
          component="img"
          src={imagePreviewUrls[0]}
          alt=""
          sx={{
            width: '100%',
            maxHeight: 220,
            objectFit: 'cover',
            borderRadius: 2,
          }}
        />
      ) : null}

      {quality ? (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('business.onboarding.firstSale.quality.label', 'Listing quality')}:{' '}
            {quality.label} ({quality.score})
          </Typography>
          <LinearProgress
            variant="determinate"
            value={quality.score}
            sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
          />
        </Box>
      ) : null}

      {(aiLoading || creating) && (
        <Alert
          severity="info"
          icon={<CircularProgress size={18} />}
          sx={{ alignItems: 'center' }}
        >
          {t(
            'business.onboarding.firstSale.review.analyzing',
            'Filled from your photos — finishing details…'
          )}
        </Alert>
      )}

      {!aiLoading && suggestions && (
        <Alert severity="success" icon={<AutoAwesomeIcon fontSize="small" />}>
          {t(
            'business.onboarding.firstSale.review.filledBanner',
            'Filled from your photos — edit anything'
          )}
        </Alert>
      )}

      {aiError && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => void applyHint()}>
              {t('common.retry', 'Retry')}
            </Button>
          }
        >
          {aiError}
        </Alert>
      )}

      {topDuplicate && (
        <Alert
          severity="info"
          icon={<DuplicateIcon fontSize="small" />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() =>
                navigate(`/business/items/${topDuplicate.itemId}`)
              }
            >
              {t(
                'business.onboarding.firstSale.review.addStockInstead',
                'Add stock instead'
              )}
            </Button>
          }
        >
          {t(
            'business.onboarding.firstSale.review.duplicateBody',
            '"{{name}}" may already be in your store.',
            { name: topDuplicate.name }
          )}
        </Alert>
      )}

      <TextField
        label={t(
          'business.onboarding.firstSale.hint.prompt',
          'What did you photograph? (optional)'
        )}
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        fullWidth
        size="small"
        InputProps={{
          endAdornment: (
            <Button size="small" onClick={() => void applyHint()} disabled={!hint.trim()}>
              {t('business.onboarding.firstSale.hint.use', 'Use hint')}
            </Button>
          ),
        }}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Stack spacing={2} flex={1}>
          <TextField
            required
            label={t('business.onboarding.firstSale.create.name', 'Name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            InputProps={{
              endAdornment:
                suggestions?.confidence?.name === 'low' ? (
                  <Chip size="small" color="warning" label={t('business.onboarding.firstSale.review.confirm', 'Confirm')} />
                ) : null,
            }}
          />
          <TextField
            required
            label={t('business.onboarding.firstSale.create.price', 'Price')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            fullWidth
            InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>{currency}</Typography> }}
          />
          <TextField
            label={t('business.onboarding.firstSale.create.category', 'Category')}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('business.onboarding.firstSale.create.subCategory', 'Subcategory')}
            value={subCategoryName}
            onChange={(e) => setSubCategoryName(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('business.onboarding.firstSale.create.brand', 'Brand')}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('business.onboarding.firstSale.create.description', 'Description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>

        <Stack spacing={2} flex={1}>
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
          <Button
            variant="outlined"
            onClick={() => navigate('/business/locations')}
          >
            {t('business.onboarding.firstSale.location.addLocation', 'New location')}
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1} sx={{ pt: 1 }}>
        <Button
          variant="contained"
          size="large"
          disabled={!canPublish || busy}
          onClick={() => void publish(false)}
          fullWidth={isNarrow}
          sx={{ minHeight: 48 }}
          startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {t('business.onboarding.firstSale.review.publish', 'Publish product')}
        </Button>
        <Button
          variant="text"
          disabled={busy || !name.trim()}
          onClick={() => void publish(true)}
          fullWidth={isNarrow}
        >
          {t('business.onboarding.firstSale.review.finishLater', 'Finish later')}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemReviewStep;
