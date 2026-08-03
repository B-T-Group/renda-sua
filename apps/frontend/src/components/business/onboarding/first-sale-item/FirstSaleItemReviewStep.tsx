import {
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
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

export interface ReviewFormValues {
  name: string;
  description: string;
  categoryName: string;
  subCategoryName: string;
  brandName: string;
  price: string;
  currency: string;
}

export interface FirstSaleItemReviewStepProps {
  imagePreviewUrls: string[];
  merchantHint: string;
  suggestions: ImageItemSuggestions | null;
  /** Prefer previously edited values when returning from publish. */
  initialValues?: ReviewFormValues | null;
  onContinue: (values: ReviewFormValues) => void;
}

const FirstSaleItemReviewStep: React.FC<FirstSaleItemReviewStepProps> = ({
  imagePreviewUrls,
  merchantHint,
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
      return;
    }
    setName(suggestions?.name?.trim() || merchantHint.trim() || '');
    setDescription(suggestions?.descriptionSuggestion?.trim() || '');
    setCategoryName(suggestions?.categoryName?.trim() || '');
    setSubCategoryName(suggestions?.subCategoryName?.trim() || '');
    setBrandName(suggestions?.brandName?.trim() || '');
    if (suggestions?.price != null) {
      setPrice(String(suggestions.price));
    }
  }, [filled, initialValues, merchantHint, suggestions]);

  const currency =
    initialValues?.currency ||
    lockedCurrency ||
    suggestions?.currency ||
    'XAF';
  const priceNum = Number.parseFloat(price);
  const canContinue =
    !!name.trim() && !Number.isNaN(priceNum) && priceNum > 0;

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
            subCategoryName,
            brandName,
            price,
            currency,
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
