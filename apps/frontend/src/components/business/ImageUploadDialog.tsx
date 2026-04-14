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
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { ItemImage, useItemImages } from '../../hooks/useItemImages';

interface ImageUploadDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
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

const hasOwnKey = (o: object, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

function getEffectivePendingType(
  index: number,
  types: Record<string, 'main' | 'gallery'>,
  hasExistingMain: boolean
): 'main' | 'gallery' {
  if (hasOwnKey(types, `file-${index}`)) {
    return types[`file-${index}`];
  }
  if (!hasExistingMain && index === 0) {
    return 'main';
  }
  return 'gallery';
}

export default function ImageUploadDialog({
  open,
  onClose,
  itemId,
  itemName,
}: ImageUploadDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const {
    loading,
    fetchItemImages,
    uploadItemImage,
    deleteItemImage,
    updateItemImageType,
  } = useItemImages();

  const [images, setImages] = useState<ItemImage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [fileImageTypes, setFileImageTypes] = useState<
    Record<string, 'main' | 'gallery'>
  >({});
  const [imagesModified, setImagesModified] = useState(false);

  useEffect(() => {
    if (open && itemId) {
      loadImages();
      setImagesModified(false);
      setFileImageTypes({});
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
    setSelectedFiles((prev) => {
      setFileImageTypes((types) => {
        const remapped: Record<string, 'main' | 'gallery'> = {};
        let ni = 0;
        for (let oi = 0; oi < prev.length; oi++) {
          if (oi === index) continue;
          if (hasOwnKey(types, `file-${oi}`)) {
            remapped[`file-${ni}`] = types[`file-${oi}`];
          }
          ni++;
        }
        return remapped;
      });
      return prev.filter((_, i) => i !== index);
    });
  };

  const hasExistingMain = images.some((i) => i.image_type === 'main');

  const handleExistingTypeChange = async (
    imageId: string,
    value: 'main' | 'gallery' | null
  ) => {
    if (value == null) return;
    const img = images.find((i) => i.id === imageId);
    if (!img) return;
    const current: 'main' | 'gallery' =
      img.image_type === 'main' ? 'main' : 'gallery';
    if (current === value) return;
    try {
      await updateItemImageType(itemId, imageId, value);
      await loadImages();
      enqueueSnackbar(
        t('business.inventory.imageTypeUpdated', 'Image type updated'),
        { variant: 'success' }
      );
      setImagesModified(true);
    } catch (e) {
      console.error('Failed to update image type:', e);
      enqueueSnackbar(
        t(
          'business.inventory.failedToUpdateImageType',
          'Failed to update image type'
        ),
        { variant: 'error' }
      );
    }
  };

  const handlePendingTypeChange = (
    index: number,
    value: 'main' | 'gallery' | null
  ) => {
    if (value == null) return;
    setFileImageTypes((prev) => {
      const next = { ...prev };
      if (value === 'main') {
        for (let i = 0; i < selectedFiles.length; i++) {
          next[`file-${i}`] = i === index ? 'main' : 'gallery';
        }
      } else {
        next[`file-${index}`] = 'gallery';
      }
      return next;
    });
  };

  const handleUpload = async () => {
    if (!profile?.id) {
      enqueueSnackbar(t('business.inventory.userIdRequired'), {
        variant: 'error',
      });
      return;
    }
    if (!profile?.business?.id) {
      enqueueSnackbar(
        t(
          'business.inventory.businessIdRequired',
          'Business profile is required to upload images'
        ),
        { variant: 'error' }
      );
      return;
    }

    const bucketName =
      process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileKey = `file-${i}`;
        const preferred = hasOwnKey(fileImageTypes, fileKey)
          ? fileImageTypes[fileKey]
          : undefined;

        await uploadItemImage(
          itemId,
          profile.business.id,
          file,
          profile.id,
          bucketName,
          altTexts[fileKey] || '',
          captions[fileKey] || '',
          preferred
        );
      }

      // Reload images
      await loadImages();

      // Reset form
      setSelectedFiles([]);
      setAltTexts({});
      setCaptions({});
      setFileImageTypes({});

      enqueueSnackbar(t('business.inventory.imagesUploadedSuccessfully'), {
        variant: 'success',
      });

      // Mark that images were modified
      setImagesModified(true);

      // Close dialog and indicate that refresh is needed
      onClose(true);
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

      // Mark that images were modified
      setImagesModified(true);
    } catch (error) {
      console.error('Failed to delete image:', error);
      enqueueSnackbar(t('business.inventory.failedToDeleteImage'), {
        variant: 'error',
      });
    }
  };

  const canUploadMore = images.length + selectedFiles.length < MAX_IMAGES;

  return (
    <Dialog
      open={open}
      onClose={() => onClose(imagesModified)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="div">
            {t(
              'business.inventory.uploadImagesFor',
              'Upload images for {{itemName}}',
              { itemName }
            )}
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => onClose(imagesModified)}
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
              <Grid container spacing={2}>
                {images.map((image) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={image.id}>
                    <Paper
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition:
                          'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          pt: '72%',
                          bgcolor: 'grey.100',
                        }}
                      >
                        <Box
                          component="img"
                          src={image.image_url}
                          alt={image.alt_text || itemName}
                          loading="lazy"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </Box>
                      <Stack
                        spacing={1.25}
                        sx={{
                          p: 1.5,
                          pt: 1.25,
                          flex: 1,
                          bgcolor: 'background.paper',
                          borderTop: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600, letterSpacing: 0.02 }}
                        >
                          {t('business.inventory.imageType', 'Image Type')}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ width: '100%' }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <ToggleButtonGroup
                              exclusive
                              fullWidth
                              size="small"
                              value={
                                image.image_type === 'main' ? 'main' : 'gallery'
                              }
                              onChange={(_, v) =>
                                handleExistingTypeChange(image.id, v)
                              }
                              disabled={loading}
                              aria-label={t(
                                'business.inventory.imageType',
                                'Image Type'
                              )}
                            >
                              <ToggleButton value="main">
                                {t(
                                  'business.inventory.imageTypePrimary',
                                  'Primary'
                                )}
                              </ToggleButton>
                              <ToggleButton value="gallery">
                                {t(
                                  'business.inventory.imageTypeSecondary',
                                  'Secondary'
                                )}
                              </ToggleButton>
                            </ToggleButtonGroup>
                          </Box>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={t('common.delete')}
                            onClick={() => handleDeleteImage(image.id)}
                            sx={{
                              flexShrink: 0,
                              border: 1,
                              borderColor: 'divider',
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
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
                          <Typography variant="caption" color="text.secondary">
                            {t('business.inventory.imageType', 'Image Type')}
                          </Typography>
                          <ToggleButtonGroup
                            exclusive
                            fullWidth
                            size="small"
                            value={getEffectivePendingType(
                              index,
                              fileImageTypes,
                              hasExistingMain
                            )}
                            onChange={(_, v) =>
                              handlePendingTypeChange(index, v)
                            }
                            disabled={loading}
                          >
                            <ToggleButton value="main">
                              {t(
                                'business.inventory.imageTypePrimary',
                                'Primary'
                              )}
                            </ToggleButton>
                            <ToggleButton value="gallery">
                              {t(
                                'business.inventory.imageTypeSecondary',
                                'Secondary'
                              )}
                            </ToggleButton>
                          </ToggleButtonGroup>
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
          onClick={() => onClose(imagesModified)}
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
