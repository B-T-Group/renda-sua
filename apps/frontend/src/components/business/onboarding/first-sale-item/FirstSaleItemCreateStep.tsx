import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Backdrop,
  Box,
  Button,
  Portal,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageCleanupLoadingAnimation from '../../../common/ImageCleanupLoadingAnimation';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useApiClient } from '../../../../hooks/useApiClient';
import { useBrands } from '../../../../hooks/useBrands';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useBusinessLocations } from '../../../../hooks/useBusinessLocations';
import { useCategories, useSubcategories } from '../../../../hooks/useCategories';
import { useCreateItemFromImage } from '../../../../hooks/useCreateItemFromImage';
import { useImageItemSuggestions } from '../../../../hooks/useImageItemSuggestions';
import { useSupportedCountries } from '../../../../hooks/useSupportedCountries';
import { Item, useItems } from '../../../../hooks/useItems';

export interface CreatedSaleItemSummary {
  id: string;
  name: string;
  price?: number;
  currency: string;
}

interface FirstSaleItemCreateStepProps {
  imageIds: string[];
  imagePreviewUrls: string[];
  /** When set (e.g. user returned from Location step), load item and PATCH on save instead of creating again. */
  existingItem?: CreatedSaleItemSummary | null;
  onComplete: (summary: CreatedSaleItemSummary) => void;
}

async function linkExtraImages(
  associate: (
    a: string,
    b: string,
    o?: { skipRefetch?: boolean }
  ) => Promise<void>,
  itemId: string,
  extras: string[]
) {
  for (const id of extras) {
    await associate(id, itemId, { skipRefetch: true });
  }
}

const FirstSaleItemCreateStep: React.FC<FirstSaleItemCreateStepProps> = ({
  imageIds,
  imagePreviewUrls,
  existingItem,
  onComplete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const apiClient = useApiClient();
  const { updateItem } = useItems(profile?.business?.id, {
    skipInitialItemsFetch: true,
  });
  const { primaryAddressCountry } = useBusinessLocations(profile?.business?.id);
  const { countries } = useSupportedCountries();
  const primaryId = imageIds[0] ?? '';
  const extraIds = imageIds.slice(1);
  const [aiTrigger, setAiTrigger] = useState(0);
  const [itemForEdit, setItemForEdit] = useState<Item | null>(null);
  /** When returning with an existing item, skip auto-filling from AI until the user clicks "Fill with AI". */
  const [skipAiHydrate, setSkipAiHydrate] = useState(() => !!existingItem?.id);
  const [saveBusy, setSaveBusy] = useState(false);
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XAF');

  const { suggestions, loading: sugLoading, error: sugError } =
    useImageItemSuggestions(imageIds, {
      autoWhen: false,
      trigger: aiTrigger,
    });
  const { createItemFromImage, loading: createLoading } =
    useCreateItemFromImage();
  const { associateImageToItem } = useBusinessImages();
  const { categories } = useCategories();
  const { brands } = useBrands();
  const selectedCategoryId = useMemo(() => {
    const match = categories.find(
      (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
    );
    return match ? String(match.id) : undefined;
  }, [categories, categoryName]);
  const { subcategories } = useSubcategories(undefined, selectedCategoryId);
  const categoryOptions = useMemo(
    () => categories.map((c) => c.name),
    [categories]
  );
  const subCategoryOptions = useMemo(
    () => subcategories.map((s) => s.name),
    [subcategories]
  );
  const brandOptions = useMemo(() => brands.map((b) => b.name), [brands]);

  useEffect(() => {
    if (!existingItem?.id) {
      setItemForEdit(null);
      setSkipAiHydrate(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: { item: Item };
        }>(`/business-items/items/${existingItem.id}`);
        const it = res.data?.data?.item;
        if (cancelled || !it) return;
        setItemForEdit(it);
        setName(it.name ?? '');
        setDescription(it.description ?? '');
        setPrice(
          it.price != null && !Number.isNaN(Number(it.price))
            ? String(it.price)
            : ''
        );
        setCurrency(it.currency ?? 'XAF');
        setCategoryName(it.item_sub_category?.item_category?.name ?? '');
        setSubCategoryName(it.item_sub_category?.name ?? '');
        setBrandName(it.brand?.name ?? '');
      } catch (e: any) {
        enqueueSnackbar(
          e?.response?.data?.error ||
            e?.message ||
            t('business.onboarding.firstSale.create.loadError', 'Could not load product'),
          { variant: 'error' }
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiClient, enqueueSnackbar, existingItem?.id, t]);

  useEffect(() => {
    if (!suggestions) return;
    if (existingItem?.id && !itemForEdit) return;
    if (skipAiHydrate && itemForEdit) return;
    setName(suggestions.name || '');
    setCategoryName(suggestions.categoryName || '');
    setSubCategoryName(suggestions.subCategoryName || '');
    setBrandName(suggestions.brandName || '');
    setDescription(suggestions.descriptionSuggestion || '');
    setPrice(
      suggestions.price != null && !Number.isNaN(suggestions.price)
        ? String(suggestions.price)
        : ''
    );
    setCurrency(suggestions.currency || 'XAF');
  }, [suggestions, itemForEdit, existingItem?.id, skipAiHydrate]);

  useEffect(() => {
    if (!primaryAddressCountry || !countries.length) return;
    const match = countries.find(
      (c) => c.code?.toUpperCase() === primaryAddressCountry.toUpperCase()
    );
    if (match?.currencyCode) {
      setCurrency(match.currencyCode.toUpperCase());
    }
  }, [primaryAddressCountry, countries]);

  useEffect(() => {
    if (!sugError) return;
    enqueueSnackbar(sugError, { variant: 'error' });
  }, [sugError, enqueueSnackbar]);

  const requestAi = () => {
    setSkipAiHydrate(false);
    setAiTrigger((n) => n + 1);
  };

  const submit = async () => {
    if (!primaryId && !itemForEdit) return;
    if (!name.trim()) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstSale.create.nameRequired',
          'Please enter a product name'
        ),
        { variant: 'warning' }
      );
      return;
    }
    const n = Number(price.trim());
    const numericPrice = price.trim() === '' || Number.isNaN(n) ? undefined : n;

    if (itemForEdit) {
      setSaveBusy(true);
      try {
        await updateItem(
          itemForEdit.id,
          {
            name: name.trim(),
            description: description.trim() || undefined,
            price: numericPrice ?? itemForEdit.price,
            currency: currency.trim() || 'XAF',
          },
          { skipRefetch: true }
        );
        enqueueSnackbar(
          t(
            'business.onboarding.firstSale.create.updateSuccess',
            'Product updated'
          ),
          { variant: 'success' }
        );
        onComplete({
          id: itemForEdit.id,
          name: name.trim(),
          price: numericPrice,
          currency: currency.trim() || 'XAF',
        });
      } catch (e: any) {
        enqueueSnackbar(
          e?.message ||
            t('business.onboarding.firstSale.create.updateError', 'Update failed'),
          { variant: 'error' }
        );
      } finally {
        setSaveBusy(false);
      }
      return;
    }

    const res = await createItemFromImage({
      imageId: primaryId,
      name: name.trim(),
      categoryName: categoryName.trim() || undefined,
      subCategoryName: subCategoryName.trim() || undefined,
      brandName: brandName.trim() || undefined,
      description: description.trim() || undefined,
      price: numericPrice,
      currency:
        numericPrice != null ? currency.trim() || 'XAF' : undefined,
    });
    const itemId = res?.item?.id;
    if (!itemId) return;
    await linkExtraImages(associateImageToItem, itemId, extraIds);
    enqueueSnackbar(
      t(
        'business.onboarding.firstSale.create.success',
        'Product created'
      ),
      { variant: 'success' }
    );
    onComplete({
      id: itemId,
      name: name.trim(),
      price: numericPrice,
      currency: currency.trim() || 'XAF',
    });
  };

  const formDisabled = sugLoading || createLoading || saveBusy;
  const priceNumber = Number(price.trim());
  const priceValid =
    price.trim() !== '' && !Number.isNaN(priceNumber) && priceNumber > 0;
  const requiredComplete =
    name.trim() !== '' &&
    categoryName.trim() !== '' &&
    subCategoryName.trim() !== '' &&
    description.trim() !== '' &&
    priceValid;

  return (
    <Stack spacing={{ xs: 2.5, sm: 2 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: { xs: '0.95rem', sm: '0.875rem' }, lineHeight: 1.5 }}
      >
        {t(
          'business.onboarding.firstSale.create.hint',
          'Fill in the details below. Optionally use AI once to suggest fields from all your photos.'
        )}
      </Typography>
      {imagePreviewUrls.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          {imagePreviewUrls.map((url, i) => (
            <Box
              key={`${url}-${i}`}
              sx={{
                width: { xs: 96, sm: 120 },
                borderRadius: 2,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'grey.50',
                aspectRatio: '1',
                minHeight: 0,
              }}
            >
              <Box
                component="img"
                src={url}
                alt=""
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </Box>
          ))}
        </Box>
      ) : null}
      <Button
        variant="outlined"
        startIcon={<AutoAwesomeIcon />}
        onClick={requestAi}
        disabled={formDisabled || !primaryId}
        fullWidth={isNarrow}
        sx={{ minHeight: 48 }}
      >
        {t(
          'business.onboarding.firstSale.create.fillWithAi',
          'Fill details with AI'
        )}
      </Button>
      <Portal>
        <Backdrop
          open={sugLoading}
          sx={(theme) => ({
            zIndex: theme.zIndex.modal + 1,
            flexDirection: 'column',
            gap: 2,
            backdropFilter: 'blur(6px)',
          })}
        >
          <Box
            role="status"
            aria-live="polite"
            aria-busy={sugLoading}
            sx={{ px: 2, maxWidth: 440, width: '100%' }}
          >
            <ImageCleanupLoadingAnimation
              minHeight={200}
              message={t(
                'business.onboarding.firstSale.create.aiWorking',
                'Analyzing your images…'
              )}
            />
          </Box>
        </Backdrop>
      </Portal>
      <TextField
        label={t('business.onboarding.firstSale.create.name', 'Name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        required
        disabled={formDisabled}
      />
      <Autocomplete
        freeSolo
        options={categoryOptions}
        value={categoryName}
        onChange={(_, v) => setCategoryName(typeof v === 'string' ? v : v ?? '')}
        inputValue={categoryName}
        onInputChange={(_, v) => setCategoryName(v)}
        disabled={formDisabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t(
              'business.onboarding.firstSale.create.category',
              'Category name'
            )}
            required
            fullWidth
          />
        )}
      />
      <Autocomplete
        freeSolo
        options={subCategoryOptions}
        value={subCategoryName}
        onChange={(_, v) =>
          setSubCategoryName(typeof v === 'string' ? v : v ?? '')
        }
        inputValue={subCategoryName}
        onInputChange={(_, v) => setSubCategoryName(v)}
        disabled={formDisabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t(
              'business.onboarding.firstSale.create.subCategory',
              'Subcategory name'
            )}
            required
            fullWidth
          />
        )}
      />
      <Autocomplete
        freeSolo
        options={brandOptions}
        value={brandName}
        onChange={(_, v) => setBrandName(typeof v === 'string' ? v : v ?? '')}
        inputValue={brandName}
        onInputChange={(_, v) => setBrandName(v)}
        disabled={formDisabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('business.onboarding.firstSale.create.brand', 'Brand')}
            fullWidth
          />
        )}
      />
      <TextField
        label={t(
          'business.onboarding.firstSale.create.description',
          'Description'
        )}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        required
        disabled={formDisabled}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={t('business.onboarding.firstSale.create.price', 'Price')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          required
          error={price.trim() !== '' && !priceValid}
          disabled={formDisabled}
          sx={{ flex: 1 }}
        />
        <TextField
          label={t(
            'business.onboarding.firstSale.create.currency',
            'Currency'
          )}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          disabled={formDisabled}
          sx={{ width: { sm: 120 }, height: { sm: 56 } }}
        />
      </Stack>
      <Button
        variant="contained"
        onClick={() => void submit()}
        disabled={
          formDisabled || (!primaryId && !itemForEdit) || !requiredComplete
        }
        fullWidth={isNarrow}
        size="large"
        sx={{ minHeight: 48 }}
      >
        {itemForEdit
          ? t('business.onboarding.firstSale.create.saveContinue', 'Save & continue')
          : t('business.onboarding.firstSale.create.continue', 'Continue')}
      </Button>
    </Stack>
  );
};

export default FirstSaleItemCreateStep;
