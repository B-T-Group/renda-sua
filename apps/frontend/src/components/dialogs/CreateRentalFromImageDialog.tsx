import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
  Alert,
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RentalItemImage } from '../../hooks/useRentalItemImages';
import { useCreateRentalFromImage } from '../../hooks/useCreateRentalFromImage';
import { useRentalFromImageSuggestions } from '../../hooks/useRentalFromImageSuggestions';
import type { RentalCategoryRow } from '../../hooks/useRentalCategories';
import ImageCleanupLoadingAnimation from '../common/ImageCleanupLoadingAnimation';

export type CreateRentalFromImageEntrySource = 'manual' | 'ai_prefill';

interface CreateRentalFromImageDialogProps {
  open: boolean;
  image: RentalItemImage | null;
  /** manual: empty form. ai_prefill: analyze image and fill fields for review. */
  entrySource: CreateRentalFromImageEntrySource;
  categories: RentalCategoryRow[];
  onClose: () => void;
  onCreated: () => void;
}

export const CreateRentalFromImageDialog: React.FC<
  CreateRentalFromImageDialogProps
> = ({ open, image, entrySource, categories, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [rentalCategoryId, setRentalCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [isActive, setIsActive] = useState(false);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [aiCategoryHint, setAiCategoryHint] = useState<string | null>(null);
  const { createRentalFromImage, loading, error } =
    useCreateRentalFromImage();
  const {
    fetchSuggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
  } = useRentalFromImageSuggestions();

  useEffect(() => {
    if (!open || !image) return;
    setName('');
    setRentalCategoryId('');
    setDescription('');
    setCurrency('XAF');
    setIsActive(false);
    setAiSuggestedTags([]);
    setAiCategoryHint(null);
  }, [open, image?.id, entrySource]);

  useEffect(() => {
    if (error) {
      enqueueSnackbar(error, { variant: 'error' });
    }
  }, [error, enqueueSnackbar]);

  useEffect(() => {
    if (suggestionsError) {
      enqueueSnackbar(suggestionsError, { variant: 'error' });
    }
  }, [suggestionsError, enqueueSnackbar]);

  useEffect(() => {
    if (!open || !image || entrySource !== 'ai_prefill') return;
    let cancelled = false;
    void (async () => {
      const data = await fetchSuggestions(image.id);
      if (cancelled || !data) return;
      setName(data.name?.trim() || image.caption?.trim() || '');
      setDescription(data.description?.trim() || '');
      setRentalCategoryId(data.rental_category_id || '');
      setCurrency(data.currency?.trim() || 'XAF');
      setAiSuggestedTags(data.suggested_tags ?? []);
      setAiCategoryHint(
        data.rental_category_id ? null : data.rentalCategorySuggestion || null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, image?.id, entrySource, fetchSuggestions]);

  const handleCreate = async () => {
    if (!image) return;
    if (!name.trim()) {
      enqueueSnackbar(
        t(
          'business.rentalImages.createFromImage.nameRequired',
          'Please enter a name for the rental item'
        ),
        { variant: 'warning' }
      );
      return;
    }
    if (!rentalCategoryId) {
      enqueueSnackbar(
        t(
          'business.rentalImages.createFromImage.categoryRequired',
          'Please select a rental category'
        ),
        { variant: 'warning' }
      );
      return;
    }
    const data = await createRentalFromImage({
      mode: 'manual',
      imageId: image.id,
      name: name.trim(),
      rental_category_id: rentalCategoryId,
      description: description.trim() || undefined,
      currency: currency.trim() || 'XAF',
      is_active: isActive,
      tags: aiSuggestedTags.length ? aiSuggestedTags : undefined,
    });
    if (!data?.item) return;
    enqueueSnackbar(
      t(
        'business.rentalImages.createFromImage.success',
        'Rental item created and image linked'
      ),
      { variant: 'success' }
    );
    onCreated();
    onClose();
  };

  const isAiFlow = entrySource === 'ai_prefill';
  const formDisabled = loading || (isAiFlow && suggestionsLoading);

  return (
    <Dialog
      open={open}
      onClose={() => !formDisabled && onClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Stack spacing={0.5}>
          <Typography variant="h6" component="span">
            {isAiFlow
              ? t(
                  'business.rentalImages.createFromImage.titleAi',
                  'Create rental item from image'
                )
              : t(
                  'business.rentalImages.createFromImage.titleManual',
                  'Create rental item (manual)'
                )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isAiFlow
              ? t(
                  'business.rentalImages.createFromImage.subtitleAi',
                  'We filled in details from the photo. Review and edit, then create.'
                )
              : t(
                  'business.rentalImages.createFromImage.subtitleManual',
                  'Enter the rental item details below, then create.'
                )}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {image && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'grey.100',
                  flexShrink: 0,
                }}
              >
                <img
                  src={image.image_url}
                  alt={image.alt_text || ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {image.caption ||
                  t(
                    'business.rentalImages.createFromImage.noCaption',
                    'No caption'
                  )}
              </Typography>
            </Box>
          )}

          {isAiFlow && suggestionsLoading && (
            <ImageCleanupLoadingAnimation
              minHeight={180}
              message={t(
                'business.rentalImages.createFromImage.analyzing',
                'Analyzing image...'
              )}
            />
          )}

          {isAiFlow && loading && !suggestionsLoading && (
            <ImageCleanupLoadingAnimation
              minHeight={180}
              message={t(
                'business.rentalImages.createFromImage.creating',
                'Creating rental item...'
              )}
            />
          )}

          {isAiFlow && aiCategoryHint && !suggestionsLoading && !loading && (
            <Alert severity="warning">
              {t(
                'business.rentalImages.createFromImage.categoryUnmatched',
                'AI suggested category "{{hint}}". Pick the closest category below.',
                { hint: aiCategoryHint }
              )}
            </Alert>
          )}

          <TextField
            label={t(
              'business.rentalImages.createFromImage.name',
              'Rental item name'
            )}
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={formDisabled}
          />
          <FormControl fullWidth disabled={formDisabled}>
            <InputLabel id="rental-cat-label">
              {t(
                'business.rentalImages.createFromImage.category',
                'Rental category'
              )}
            </InputLabel>
            <Select
              labelId="rental-cat-label"
              label={t(
                'business.rentalImages.createFromImage.category',
                'Rental category'
              )}
              value={rentalCategoryId}
              onChange={(e) => setRentalCategoryId(e.target.value)}
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
              'business.rentalImages.createFromImage.description',
              'Description'
            )}
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={formDisabled}
          />
          {isAiFlow && aiSuggestedTags.length > 0 && !suggestionsLoading && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t(
                  'business.rentalImages.createFromImage.suggestedTags',
                  'Suggested tags'
                )}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {aiSuggestedTags.map((tag) => (
                  <Chip key={tag} size="small" label={tag} variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}
          <TextField
            label={t(
              'business.rentalImages.createFromImage.currency',
              'Currency'
            )}
            fullWidth
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            disabled={formDisabled}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(_, v) => setIsActive(v)}
                disabled={formDisabled}
              />
            }
            label={t(
              'business.rentalImages.createFromImage.active',
              'Active in catalog'
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} disabled={formDisabled}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleCreate()}
          disabled={formDisabled}
        >
          {t(
            'business.rentalImages.createFromImage.submit',
            'Create rental item'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
