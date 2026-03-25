import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageCleanupLoadingAnimation from '../../../common/ImageCleanupLoadingAnimation';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useCreateItemFromImage } from '../../../../hooks/useCreateItemFromImage';
import { useImageItemSuggestions } from '../../../../hooks/useImageItemSuggestions';

export interface CreatedSaleItemSummary {
  id: string;
  name: string;
  price?: number;
  currency: string;
}

interface FirstSaleItemCreateStepProps {
  imageIds: string[];
  primaryImagePreviewUrl: string | null;
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
  primaryImagePreviewUrl,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const primaryId = imageIds[0] ?? '';
  const extraIds = imageIds.slice(1);
  const [aiTrigger, setAiTrigger] = useState(0);
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XAF');

  const { suggestions, loading: sugLoading, error: sugError } =
    useImageItemSuggestions(primaryId, {
      autoWhen: false,
      trigger: aiTrigger,
    });
  const { createItemFromImage, loading: createLoading } =
    useCreateItemFromImage();
  const { associateImageToItem } = useBusinessImages();

  useEffect(() => {
    if (!suggestions) return;
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
  }, [suggestions]);

  useEffect(() => {
    if (!sugError) return;
    enqueueSnackbar(sugError, { variant: 'error' });
  }, [sugError, enqueueSnackbar]);

  const requestAi = () => setAiTrigger((n) => n + 1);

  const submit = async () => {
    if (!primaryId) return;
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

  const formDisabled = sugLoading || createLoading;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.onboarding.firstSale.create.hint',
          'Fill in the details below. Optionally use AI once to suggest fields from your photo.'
        )}
      </Typography>
      {primaryImagePreviewUrl ? (
        <Box
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            maxHeight: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={primaryImagePreviewUrl}
            alt=""
            sx={{
              maxHeight: 200,
              width: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
      ) : null}
      <Button
        variant="outlined"
        startIcon={<AutoAwesomeIcon />}
        onClick={requestAi}
        disabled={formDisabled || !primaryId}
      >
        {t(
          'business.onboarding.firstSale.create.fillWithAi',
          'Fill details with AI'
        )}
      </Button>
      {sugLoading && (
        <ImageCleanupLoadingAnimation
          minHeight={140}
          message={t(
            'business.onboarding.firstSale.create.aiWorking',
            'Analyzing your image…'
          )}
        />
      )}
      <TextField
        label={t('business.onboarding.firstSale.create.name', 'Name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        required
        disabled={formDisabled}
      />
      <TextField
        label={t(
          'business.onboarding.firstSale.create.category',
          'Category name'
        )}
        value={categoryName}
        onChange={(e) => setCategoryName(e.target.value)}
        fullWidth
        disabled={formDisabled}
      />
      <TextField
        label={t(
          'business.onboarding.firstSale.create.subCategory',
          'Subcategory name'
        )}
        value={subCategoryName}
        onChange={(e) => setSubCategoryName(e.target.value)}
        fullWidth
        disabled={formDisabled}
      />
      <TextField
        label={t('business.onboarding.firstSale.create.brand', 'Brand')}
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        fullWidth
        disabled={formDisabled}
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
        disabled={formDisabled}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={t('business.onboarding.firstSale.create.price', 'Price')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
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
          sx={{ width: { sm: 120 } }}
        />
      </Stack>
      <Button
        variant="contained"
        onClick={() => void submit()}
        disabled={formDisabled || !primaryId}
      >
        {t('business.onboarding.firstSale.create.continue', 'Continue')}
      </Button>
    </Stack>
  );
};

export default FirstSaleItemCreateStep;
