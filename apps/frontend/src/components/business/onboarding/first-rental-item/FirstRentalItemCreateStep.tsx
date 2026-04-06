import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import {
  Alert,
  Backdrop,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Portal,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageCleanupLoadingAnimation from '../../../common/ImageCleanupLoadingAnimation';
import { useCreateRentalFromImage } from '../../../../hooks/useCreateRentalFromImage';
import { useRentalCategories } from '../../../../hooks/useRentalCategories';
import { useRentalFromImageSuggestions } from '../../../../hooks/useRentalFromImageSuggestions';
import { useRentalItemImages } from '../../../../hooks/useRentalItemImages';
import type { FirstRentalUploadResult } from './firstRentalUploadTypes';

export interface CreatedRentalItemSummary {
  id: string;
  name: string;
}

interface FirstRentalItemCreateStepProps {
  upload: FirstRentalUploadResult;
  onComplete: (summary: CreatedRentalItemSummary) => void;
}

async function linkExtraRentalImages(
  associate: (
    a: string,
    b: string,
    o?: { skipRefetch?: boolean }
  ) => Promise<void>,
  rentalItemId: string,
  extras: string[]
) {
  for (const id of extras) {
    await associate(id, rentalItemId, { skipRefetch: true });
  }
}

async function applyGalleryOrder(
  updateImage: (
    id: string,
    changes: { display_order: number }
  ) => Promise<unknown>,
  mainImageId: string,
  allIds: string[]
) {
  const rest = allIds.filter((id) => id !== mainImageId);
  const ordered = [mainImageId, ...rest];
  for (let i = 0; i < ordered.length; i++) {
    await updateImage(ordered[i], { display_order: i });
  }
}

const FirstRentalItemCreateStep: React.FC<FirstRentalItemCreateStepProps> = ({
  upload,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { imageIds, files, mainImageIndex } = upload;
  const [sourceImageIndex, setSourceImageIndex] = useState(mainImageIndex);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [aiTrigger, setAiTrigger] = useState(0);
  const [name, setName] = useState('');
  const [rentalCategoryId, setRentalCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [aiCategoryHint, setAiCategoryHint] = useState<string | null>(null);

  const sourceId = imageIds[sourceImageIndex] ?? '';
  const mainId = imageIds[mainImageIndex] ?? '';

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    setAiSuggestedTags([]);
    setAiCategoryHint(null);
  }, [sourceImageIndex]);

  const { categories, loading: catLoading } = useRentalCategories();
  const { suggestions, loading: sugLoading, error: sugError } =
    useRentalFromImageSuggestions(sourceId || null, {
      autoWhen: false,
      trigger: aiTrigger,
    });
  const {
    createRentalFromImage,
    loading: createLoading,
    error: createError,
  } = useCreateRentalFromImage();
  const { associateToRentalItem, updateImage } = useRentalItemImages();

  useEffect(() => {
    if (!suggestions) return;
    setName(suggestions.name?.trim() || '');
    setDescription(suggestions.description?.trim() || '');
    setRentalCategoryId(suggestions.rental_category_id || '');
    setCurrency(suggestions.currency?.trim() || 'XAF');
    setAiSuggestedTags(suggestions.suggested_tags ?? []);
    setAiCategoryHint(
      suggestions.rental_category_id
        ? null
        : suggestions.rentalCategorySuggestion || null
    );
  }, [suggestions]);

  useEffect(() => {
    if (!sugError) return;
    enqueueSnackbar(sugError, { variant: 'error' });
  }, [sugError, enqueueSnackbar]);

  useEffect(() => {
    if (!createError) return;
    enqueueSnackbar(createError, { variant: 'error' });
  }, [createError, enqueueSnackbar]);

  const requestAi = () => setAiTrigger((n) => n + 1);

  const submit = async () => {
    if (!sourceId) return;
    if (!name.trim() || !rentalCategoryId) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.create.manualRequired',
          'Name and category are required'
        ),
        { variant: 'warning' }
      );
      return;
    }
    const res = await createRentalFromImage({
      mode: 'manual',
      imageId: sourceId,
      name: name.trim(),
      rental_category_id: rentalCategoryId,
      description: description.trim() || undefined,
      currency: currency.trim() || 'XAF',
      is_active: false,
      tags: aiSuggestedTags.length ? aiSuggestedTags : undefined,
    });
    const rid = res?.item?.id;
    const rname = res?.item?.name;
    if (!rid || !rname) return;
    const extraIds = imageIds.filter((id) => id !== sourceId);
    await linkExtraRentalImages(associateToRentalItem, rid, extraIds);
    try {
      await applyGalleryOrder(updateImage, mainId, imageIds);
    } catch {
      /* display order is best-effort */
    }
    enqueueSnackbar(
      t(
        'business.onboarding.firstRental.create.success',
        'Rental item created'
      ),
      { variant: 'success' }
    );
    onComplete({ id: rid, name: rname });
  };

  const formDisabled = catLoading || sugLoading || createLoading;
  const heroUrl = previewUrls[sourceImageIndex];

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.onboarding.firstRental.create.hint',
          'Choose which photo AI should read, fill in the details, then continue.'
        )}
      </Typography>
      {imageIds.length > 1 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t(
              'business.onboarding.firstRental.create.aiSourceLabel',
              'Photo for AI suggestions'
            )}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {imageIds.map((id, i) => (
              <Box
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => setSourceImageIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSourceImageIndex(i);
                  }
                }}
                sx={{
                  position: 'relative',
                  border: 2,
                  borderColor:
                    sourceImageIndex === i ? 'secondary.main' : 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  width: 88,
                  height: 88,
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {previewUrls[i] ? (
                  <Box
                    component="img"
                    src={previewUrls[i]}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : null}
                {sourceImageIndex === i ? (
                  <Chip
                    size="small"
                    color="secondary"
                    label={t(
                      'business.onboarding.firstRental.create.aiSourceBadge',
                      'AI'
                    )}
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      height: 20,
                      fontSize: '0.65rem',
                    }}
                  />
                ) : null}
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
      {heroUrl ? (
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
            src={heroUrl}
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
        disabled={formDisabled || !sourceId}
      >
        {t(
          'business.onboarding.firstRental.create.fillWithAi',
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
                'business.onboarding.firstRental.create.aiWorking',
                'Analyzing your image…'
              )}
            />
          </Box>
        </Backdrop>
      </Portal>
      {aiCategoryHint && (
        <Alert severity="info">
          {t(
            'business.onboarding.firstRental.create.categoryHint',
            'Suggested category: {{hint}}. Pick the closest match below if needed.',
            { hint: aiCategoryHint }
          )}
        </Alert>
      )}
      <TextField
        label={t('business.onboarding.firstRental.create.name', 'Name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        required
        disabled={formDisabled}
      />
      <FormControl fullWidth disabled={formDisabled}>
        <InputLabel id="rcat">
          {t(
            'business.onboarding.firstRental.create.category',
            'Rental category'
          )}
        </InputLabel>
        <Select
          labelId="rcat"
          label={t(
            'business.onboarding.firstRental.create.category',
            'Rental category'
          )}
          value={rentalCategoryId}
          onChange={(e) => setRentalCategoryId(e.target.value as string)}
          required
        >
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label={t(
          'business.onboarding.firstRental.create.description',
          'Description'
        )}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        disabled={formDisabled}
      />
      <TextField
        label={t(
          'business.onboarding.firstRental.create.currency',
          'Currency'
        )}
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        disabled={formDisabled}
      />
      {aiSuggestedTags.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {aiSuggestedTags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
      <Button
        variant="contained"
        onClick={() => void submit()}
        disabled={formDisabled || !sourceId}
      >
        {t('business.onboarding.firstRental.create.continue', 'Continue')}
      </Button>
    </Stack>
  );
};

export default FirstRentalItemCreateStep;
