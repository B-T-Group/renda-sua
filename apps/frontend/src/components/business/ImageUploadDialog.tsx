import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Paper,
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
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="div">
            {t('business.inventory.uploadImagesFor', { itemName })}
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Current Images */}
          {images.length > 0 && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ color: 'primary.main', fontWeight: 600 }}
              >
                {t('business.inventory.currentImages')} ({images.length}/
                {MAX_IMAGES})
              </Typography>
              <ImageList
                sx={{
                  width: '100%',
                  height: 240,
                  '& .MuiImageListItem-root': {
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition:
                      'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    },
                  },
                }}
                cols={3}
                rowHeight={180}
                gap={12}
              >
                {images.map((image) => (
                  <ImageListItem key={image.id}>
                    <img
                      src={image.image_url}
                      alt={image.alt_text || itemName}
                      loading="lazy"
                      style={{
                        objectFit: 'cover',
                        height: '100%',
                        width: '100%',
                      }}
                    />
                    <ImageListItemBar
                      position="bottom"
                      sx={{
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                        '& .MuiImageListItemBar-actionIcon': {
                          color: 'white',
                        },
                      }}
                      actionIcon={
                        <IconButton
                          sx={{
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'rgba(255,255,255,0.2)',
                            },
                          }}
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
            </Paper>
          )}

          {/* File Upload */}
          {canUploadMore && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ color: 'primary.main', fontWeight: 600 }}
              >
                {t('business.inventory.addNewImages')}
                {selectedFiles.length > 0 && (
                  <Typography
                    component="span"
                    sx={{ color: 'text.secondary', fontWeight: 400, ml: 1 }}
                  >
                    ({selectedFiles.length} selected)
                  </Typography>
                )}
              </Typography>

              <Button
                variant="contained"
                component="label"
                startIcon={<AddIcon />}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                  py: 1.5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  '&:hover': {
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  },
                }}
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
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 2,
                  }}
                >
                  {selectedFiles.map((file, index) => (
                    <Card
                      key={index}
                      sx={{
                        borderRadius: 2,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        transition:
                          'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box
                          sx={{
                            position: 'relative',
                            borderRadius: 1,
                            overflow: 'hidden',
                            mb: 2,
                          }}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            style={{
                              width: '100%',
                              height: 140,
                              objectFit: 'cover',
                            }}
                          />
                        </Box>

                        <Typography
                          variant="caption"
                          display="block"
                          sx={{
                            mb: 2,
                            fontWeight: 500,
                            color: 'text.secondary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.name}
                        </Typography>

                        <Stack spacing={1.5}>
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
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 1.5,
                              },
                            }}
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
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 1.5,
                              },
                            }}
                          />
                        </Stack>
                      </CardContent>

                      <CardActions sx={{ p: 2, pt: 0 }}>
                        <Button
                          fullWidth
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteIcon />}
                          onClick={() => removeSelectedFile(index)}
                          sx={{
                            borderRadius: 1.5,
                            textTransform: 'none',
                          }}
                        >
                          {t('common.remove')}
                        </Button>
                      </CardActions>
                    </Card>
                  ))}
                </Box>
              )}
            </Paper>
          )}

          {!canUploadMore && (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                textAlign: 'center',
                backgroundColor: 'grey.50',
                border: '1px dashed',
                borderColor: 'grey.300',
              }}
            >
              <Typography
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: '1rem',
                }}
              >
                {t('business.inventory.maxImagesReached', { max: MAX_IMAGES })}
              </Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 2, backgroundColor: 'grey.50' }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1,
          }}
        >
          {t('common.cancel')}
        </Button>
        {selectedFiles.length > 0 && (
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={loading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:hover': {
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              },
            }}
          >
            {loading
              ? t('common.uploading')
              : t('business.inventory.uploadImages')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
