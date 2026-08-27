import {
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessLockedCurrency } from '../../../../hooks/useBusinessLockedCurrency';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import type { ImageItemSuggestions } from '../../../../hooks/useImageItemSuggestions';
import { FOOD_CATEGORY_NAME } from '../../../../constants/food';

export interface ReviewFormValues {
  name: string;
  description: string;
  categoryName: string;
  subCategoryName: string;
  brandName: string;
  price: string;
  currency: string;
  isUsed: boolean;
  dimensions: string;
  preparationMinutes: string;
}

export interface FirstSaleItemReviewStepProps {
  imagePreviewUrls: string[];
  merchantHint: string;
  /** Price captured on the description step — preferred over AI suggestion. */
  merchantPrice?: string;
  /** Cooked food, chosen on the description step. Forces the food category. */
  isFoodItem?: boolean;
  /** Preparation minutes captured on the description step. */
  merchantPreparationMinutes?: string;
  suggestions: ImageItemSuggestions | null;
  /** Prefer previously edited values when returning from publish. */
  initialValues?: ReviewFormValues | null;
  onContinue: (values: ReviewFormValues) => void;
}

const FirstSaleItemReviewStep: React.FC<FirstSaleItemReviewStepProps> = ({
  imagePreviewUrls,
  merchantHint,
  merchantPrice = '',
  isFoodItem = false,
  merchantPreparationMinutes = '',
  suggestions,
  initialValues = null,
  onContinue,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { lockedCurrency } = useBusinessLockedCurrency(profile?.business?.id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [price, setPrice] = useState('');
  const [isUsed, setIsUsed] = useState(false);
  const [dimensions, setDimensions] = useState('');
  const [preparationMinutes, setPreparationMinutes] = useState('');
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (filled) return;
    setFilled(true);
    if (initialValues) {
      setName(initialValues.name);
      setDescription(initialValues.description);
      setCategoryName(initialValues.categoryName);
      setSubCategoryName(initialValues.subCategoryName);
      setBrandName(initialValues.brandName);
      setPrice(initialValues.price);
      setIsUsed(initialValues.isUsed);
      setDimensions(initialValues.dimensions);
      setPreparationMinutes(initialValues.preparationMinutes);
      return;
    }
    setName(suggestions?.name?.trim() || merchantHint.trim() || '');
    setDescription(suggestions?.descriptionSuggestion?.trim() || '');
    setCategoryName(
      isFoodItem ? FOOD_CATEGORY_NAME : suggestions?.categoryName?.trim() || ''
    );
    setSubCategoryName(suggestions?.subCategoryName?.trim() || '');
    setBrandName(suggestions?.brandName?.trim() || '');
    setIsUsed(suggestions?.isUsed === true);
    setDimensions(suggestions?.dimensions?.trim() || '');
    setPreparationMinutes(merchantPreparationMinutes.trim());
    if (merchantPrice.trim()) {
      setPrice(merchantPrice.trim());
    } else if (suggestions?.price != null) {
      setPrice(String(suggestions.price));
    }
  }, [
    filled,
    initialValues,
    isFoodItem,
    merchantHint,
    merchantPreparationMinutes,
    merchantPrice,
    suggestions,
  ]);

  const currency =
    initialValues?.currency ||
    lockedCurrency ||
    suggestions?.currency ||
    'XAF';
  const priceNum = Number.parseFloat(price);
  const sizeRequired = suggestions?.isSizeRequired === true;
  const canContinue =
    !!name.trim() &&
    !Number.isNaN(priceNum) &&
    priceNum > 0 &&
    (!sizeRequired || !!dimensions.trim());

  const quality = suggestions?.listingQuality;
  const topDuplicate = suggestions?.duplicateCandidates?.[0];

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

      {suggestions ? (
        <Alert severity="success" icon={<AutoAwesomeIcon fontSize="small" />}>
          {t(
            'business.onboarding.firstSale.review.filledBanner',
            'Filled from your photos — edit anything'
          )}
        </Alert>
      ) : (
        <Alert severity="info">
          {t(
            'business.onboarding.firstSale.review.manualFill',
            'Fill in the details below, then continue to publish.'
          )}
        </Alert>
      )}

      {topDuplicate ? (
        <Alert
          severity="info"
          icon={<DuplicateIcon fontSize="small" />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(`/business/items/${topDuplicate.itemId}`)}
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
      ) : null}

      <TextField
        required
        label={t('business.onboarding.firstSale.create.name', 'Name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        InputProps={{
          endAdornment:
            suggestions?.confidence?.name === 'low' ? (
              <Chip
                size="small"
                color="warning"
                label={t('business.onboarding.firstSale.review.confirm', 'Confirm')}
              />
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
        InputProps={{
          startAdornment: <Typography sx={{ mr: 1 }}>{currency}</Typography>,
        }}
      />
      {isFoodItem && (
        <TextField
          label={t(
            'business.items.preparationMinutes',
            'Preparation time (minutes)'
          )}
          value={preparationMinutes}
          onChange={(e) => setPreparationMinutes(e.target.value)}
          type="number"
          fullWidth
          inputProps={{ min: 0, max: 1440, step: 5 }}
        />
      )}
      <TextField
        label={t('business.onboarding.firstSale.create.category', 'Category')}
        value={categoryName}
        onChange={(e) => setCategoryName(e.target.value)}
        fullWidth
      />
      <TextField
        label={t(
          'business.onboarding.firstSale.create.subCategory',
          'Subcategory'
        )}
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
      {sizeRequired ? (
        <TextField
          required
          label={t('business.onboarding.firstSale.review.size', 'Size')}
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
          fullWidth
          helperText={t(
            'business.onboarding.firstSale.review.sizeHelper',
            'e.g. M, 42, 50ml'
          )}
          placeholder="M, 42, 50ml"
        />
      ) : null}
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
      />
      <FormControlLabel
        control={
          <Switch
            checked={isUsed}
            onChange={(e) => setIsUsed(e.target.checked)}
            color="warning"
          />
        }
        label={t(
          'business.onboarding.firstSale.review.isUsed',
          'This item is used'
        )}
      />

      <Button
        variant="contained"
        size="large"
        disabled={!canContinue}
        fullWidth={isNarrow}
        sx={{ minHeight: 48 }}
        onClick={() =>
          onContinue({
            name,
            description,
            categoryName,
            preparationMinutes,
            subCategoryName,
            brandName,
            price,
            currency,
            isUsed,
            dimensions,
          })
        }
      >
        {t(
          'business.onboarding.firstSale.review.continuePublish',
          'Continue to publish'
        )}
      </Button>
    </Stack>
  );
};

export default FirstSaleItemReviewStep;
