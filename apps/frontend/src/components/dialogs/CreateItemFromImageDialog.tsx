import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BusinessImage } from '../../hooks/useBusinessImages';
import { useCreateItemFromImage } from '../../hooks/useCreateItemFromImage';
import { useImageItemSuggestions } from '../../hooks/useImageItemSuggestions';

interface CreateItemFromImageDialogProps {
  open: boolean;
  image: BusinessImage | null;
  onClose: () => void;
  onCreated: (item: any) => void;
}

export const CreateItemFromImageDialog: React.FC<
  CreateItemFromImageDialogProps
> = ({ open, image, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [currency, setCurrency] = useState<string>('XAF');
  const [showSummary, setShowSummary] = useState(false);
  const [createdItem, setCreatedItem] = useState<any | null>(null);

  const { loading: suggestionsLoading, suggestions, error: suggestionsError } =
    useImageItemSuggestions(image?.id ?? null, open);

  const {
    createItemFromImage,
    loading: createLoading,
    error: createError,
  } = useCreateItemFromImage();

  useEffect(() => {
    if (!open || !image) {
      return;
    }
    setShowSummary(false);
    setCreatedItem(null);
    if (suggestions) {
      setName(suggestions.name || image.caption || '');
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
    } else {
      setName(image.caption || '');
      setCategoryName('');
      setSubCategoryName('');
      setBrandName('');
      setDescription('');
      setPrice('');
      setCurrency('XAF');
    }
  }, [open, image, suggestions]);

  useEffect(() => {
    if (suggestionsError) {
      enqueueSnackbar(
        suggestionsError ||
          t(
            'business.images.createItemFromImage.suggestionsError',
            'Failed to get suggestions from image'
          ),
        { variant: 'error' }
      );
    }
  }, [suggestionsError, enqueueSnackbar, t]);

  useEffect(() => {
    if (createError) {
      enqueueSnackbar(
        createError ||
          t(
            'business.images.createItemFromImage.createError',
            'Failed to create item from image'
          ),
        { variant: 'error' }
      );
    }
  }, [createError, enqueueSnackbar, t]);

  const handleClose = () => {
    if (createLoading) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!image) return;
    if (!name.trim()) {
      enqueueSnackbar(
        t(
          'business.images.createItemFromImage.nameRequired',
          'Please provide a name for the item'
        ),
        { variant: 'warning' }
      );
      return;
    }
    const numericPrice =
      price.trim() === '' ? undefined : Number(price.trim()) || undefined;

    const result = await createItemFromImage({
      imageId: image.id,
      name: name.trim(),
      categoryName: categoryName.trim() || undefined,
      subCategoryName: subCategoryName.trim() || undefined,
      brandName: brandName.trim() || undefined,
      description: description.trim() || undefined,
      price: numericPrice,
      currency:
        numericPrice != null && !Number.isNaN(numericPrice)
          ? currency.trim() || 'XAF'
          : undefined,
    });
    if (!result) return;
    setCreatedItem(result);
    setShowSummary(true);
    onCreated(result);
    enqueueSnackbar(
      t(
        'business.images.createItemFromImage.success',
        'Item created from image successfully'
      ),
      { variant: 'success' }
    );
  };

  const renderForm = () => (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {image && (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
          }}
        >
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
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {t(
                'business.images.createItemFromImage.imageTitle',
                'Image {{id}}',
                { id: image.id.slice(0, 8) }
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {image.caption ||
                t(
                  'business.images.createItemFromImage.noCaption',
                  'No caption provided'
                )}
            </Typography>
          </Box>
        </Box>
      )}

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.name',
          'Item name'
        )}
        fullWidth
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={createLoading || suggestionsLoading}
      />

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.category',
          'Category'
        )}
        fullWidth
        value={categoryName}
        onChange={(e) => setCategoryName(e.target.value)}
        disabled={createLoading || suggestionsLoading}
      />

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.subcategory',
          'Subcategory'
        )}
        fullWidth
        value={subCategoryName}
        onChange={(e) => setSubCategoryName(e.target.value)}
        disabled={createLoading || suggestionsLoading}
      />

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.brand',
          'Brand'
        )}
        fullWidth
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        disabled={createLoading || suggestionsLoading}
      />

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.price',
          'Price'
        )}
        fullWidth
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        disabled={createLoading || suggestionsLoading}
      />

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.currency',
          'Currency'
        )}
        fullWidth
        value={currency}
        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        disabled={createLoading || suggestionsLoading}
      />

      <TextField
        label={t(
          'business.images.createItemFromImage.fields.description',
          'Description'
        )}
        fullWidth
        multiline
        minRows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={createLoading || suggestionsLoading}
      />
    </Stack>
  );

  const renderSummary = () => {
    if (!createdItem) return null;
    const item = createdItem.item || createdItem;
    return (
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="subtitle1">
          {t(
            'business.images.createItemFromImage.summaryTitle',
            'Item created from image'
          )}
        </Typography>
        <Typography variant="body2">
          <strong>
            {t(
              'business.images.createItemFromImage.fields.name',
              'Item name'
            )}
            :
          </strong>{' '}
          {item.name}
        </Typography>
        <Typography variant="body2">
          <strong>SKU:</strong> {item.sku}
        </Typography>
        <Typography variant="body2">
          <strong>
            {t(
              'business.images.createItemFromImage.fields.category',
              'Category'
            )}
            :
          </strong>{' '}
          {item.item_category?.name || '—'}
        </Typography>
        <Typography variant="body2">
          <strong>
            {t(
              'business.images.createItemFromImage.fields.subcategory',
              'Subcategory'
            )}
            :
          </strong>{' '}
          {item.item_sub_category?.name || '—'}
        </Typography>
        <Typography variant="body2">
          <strong>
            {t(
              'business.images.createItemFromImage.fields.brand',
              'Brand'
            )}
            :
          </strong>{' '}
          {item.brand?.name || '—'}
        </Typography>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t(
          'business.images.createItemFromImage.title',
          'Create item from image'
        )}
      </DialogTitle>
      <DialogContent>
        {showSummary ? renderSummary() : renderForm()}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createLoading}>
          {showSummary
            ? t('common.close', 'Close')
            : t('common.cancel', 'Cancel')}
        </Button>
        {!showSummary && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createLoading || suggestionsLoading}
          >
            {t(
              'business.images.createItemFromImage.submit',
              'Create item'
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

