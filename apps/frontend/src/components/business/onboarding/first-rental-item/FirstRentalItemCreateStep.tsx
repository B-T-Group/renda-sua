import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
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

export interface CreatedRentalItemSummary {
  id: string;
  name: string;
}

interface FirstRentalItemCreateStepProps {
  imageIds: string[];
  primaryImagePreviewUrl: string | null;
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

const FirstRentalItemCreateStep: React.FC<FirstRentalItemCreateStepProps> = ({
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
  const [rentalCategoryId, setRentalCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [aiCategoryHint, setAiCategoryHint] = useState<string | null>(null);

  const { categories, loading: catLoading } = useRentalCategories();
  const { suggestions, loading: sugLoading, error: sugError } =
    useRentalFromImageSuggestions(primaryId, {
      autoWhen: false,
      trigger: aiTrigger,
    });
  const {
    createRentalFromImage,
    loading: createLoading,
    error: createError,
  } = useCreateRentalFromImage();
  const { associateToRentalItem } = useRentalItemImages();

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
    if (!primaryId) return;
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
      imageId: primaryId,
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
    await linkExtraRentalImages(associateToRentalItem, rid, extraIds);
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

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.onboarding.firstRental.create.hint',
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
          'business.onboarding.firstRental.create.fillWithAi',
          'Fill details with AI'
        )}
      </Button>
      {sugLoading && (
        <ImageCleanupLoadingAnimation
          minHeight={140}
          message={t(
            'business.onboarding.firstRental.create.aiWorking',
            'Analyzing your image…'
          )}
        />
      )}
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
        disabled={formDisabled || !primaryId}
      >
        {t('business.onboarding.firstRental.create.continue', 'Continue')}
      </Button>
    </Stack>
  );
};

export default FirstRentalItemCreateStep;
