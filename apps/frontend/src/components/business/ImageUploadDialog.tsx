import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemImage, useItemImages } from '../../hooks/useItemImages';
import { useProfile } from '../../hooks/useProfile';

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
}

const MAX_IMAGES = 5;
const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ImageUploadDialog({
  open,
  onClose,
  itemId,
  itemName,
}: ImageUploadDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { userProfile } = useProfile();
  const { loading, error, fetchItemImages, uploadItemImage, deleteItemImage } =
    useItemImages();

  const [images, setImages] = useState<ItemImage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && itemId) {
      loadImages();
    }
  }, [open, itemId]);

  const loadImages = async () => {
    try {
      const itemImages = await fetchItemImages(itemId);
      setImages(itemImages);
    } catch (error) {
      console.error('Failed to load images:', error);
      enqueueSnackbar(t('business.inventory.failedToLoadImages'), {
        variant: 'error',
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Validate file count
    if (images.length + selectedFiles.length + files.length > MAX_IMAGES) {
      enqueueSnackbar(
        t('business.inventory.maxImagesExceeded', { max: MAX_IMAGES }),
        { variant: 'error' }
      );
      return;
    }

    // Validate file types and sizes
    const validFiles = files.filter((file) => {
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        enqueueSnackbar(
          t('business.inventory.invalidFileType', { file: file.name }),
          { variant: 'error' }
        );
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        enqueueSnackbar(
          t('business.inventory.fileTooLarge', { file: file.name }),
          { variant: 'error' }
        );
        return false;
      }
      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!userProfile?.id) {
      enqueueSnackbar(t('business.inventory.userIdRequired'), {
        variant: 'error',
      });
      return;
    }

    const bucketName =
      process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileKey = `file-${i}`;

        await uploadItemImage(
          itemId,
          file,
          userProfile.id,
          bucketName,
          altTexts[fileKey] || '',
          captions[fileKey] || ''
        );
      }

      // Reload images
      await loadImages();

      // Reset form
      setSelectedFiles([]);
      setAltTexts({});
      setCaptions({});

      enqueueSnackbar(t('business.inventory.imagesUploadedSuccessfully'), {
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to upload images:', error);
      enqueueSnackbar(t('business.inventory.failedToUploadImages'), {
        variant: 'error',
      });
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteItemImage(imageId);
      await loadImages();
      enqueueSnackbar(t('business.inventory.imageDeletedSuccessfully'), {
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to delete image:', error);
      enqueueSnackbar(t('business.inventory.failedToDeleteImage'), {
        variant: 'error',
      });
    }
  };

  const canUploadMore = images.length + selectedFiles.length < MAX_IMAGES;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('business.inventory.uploadImagesFor', { itemName })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Current Images */}
          {images.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.currentImages')} ({images.length}/
                {MAX_IMAGES})
              </Typography>
              <ImageList
                sx={{ width: '100%', height: 200 }}
                cols={3}
                rowHeight={164}
              >
                {images.map((image) => (
                  <ImageListItem key={image.id}>
                    <img
                      src={image.image_url}
                      alt={image.alt_text || itemName}
                      loading="lazy"
                      style={{ objectFit: 'cover' }}
                    />
                    <ImageListItemBar
                      actionIcon={
                        <IconButton
                          sx={{ color: 'white' }}
                          aria-label={t('common.delete')}
                          onClick={() => handleDeleteImage(image.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}

          {/* File Upload */}
          {canUploadMore && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.inventory.addNewImages')} ({selectedFiles.length}{' '}
                selected)
              </Typography>

              <Button
                variant="outlined"
                component="label"
                startIcon={<AddIcon />}
                sx={{ mb: 2 }}
              >
                {t('business.inventory.selectImages')}
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                />
              </Button>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                  {selectedFiles.map((file, index) => (
                    <Box
                      key={index}
                      sx={{
                        width: 200,
                        border: 1,
                        borderColor: 'grey.300',
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        style={{
                          width: '100%',
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 4,
                        }}
                      />
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ mt: 1 }}
                      >
                        {file.name}
                      </Typography>

                      <TextField
                        fullWidth
                        size="small"
                        label={t('business.inventory.altText')}
                        value={altTexts[`file-${index}`] || ''}
                        onChange={(e) =>
                          setAltTexts((prev) => ({
                            ...prev,
                            [`file-${index}`]: e.target.value,
                          }))
                        }
                        sx={{ mt: 1 }}
                      />

                      <TextField
                        fullWidth
                        size="small"
                        label={t('business.inventory.caption')}
                        value={captions[`file-${index}`] || ''}
                        onChange={(e) =>
                          setCaptions((prev) => ({
                            ...prev,
                            [`file-${index}`]: e.target.value,
                          }))
                        }
                        sx={{ mt: 1 }}
                      />

                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeSelectedFile(index)}
                        sx={{ mt: 1 }}
                      >
                        {t('common.remove')}
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {!canUploadMore && (
            <Typography color="text.secondary">
              {t('business.inventory.maxImagesReached', { max: MAX_IMAGES })}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        {selectedFiles.length > 0 && (
          <Button onClick={handleUpload} variant="contained" disabled={loading}>
            {loading
              ? t('common.uploading')
              : t('business.inventory.uploadImages')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
