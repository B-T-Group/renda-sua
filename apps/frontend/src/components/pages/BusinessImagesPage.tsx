import {
  Add as AddIcon,
  AutoFixHigh as AutoFixHighIcon,
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../common/ConfirmationModal';
import ImageCleanupPreviewDialog from '../dialogs/ImageCleanupPreviewDialog';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessImages, type BusinessImage } from '../../hooks/useBusinessImages';
import { useBusinessItemSearch } from '../../hooks/useBusinessItemSearch';
import { useCategories, useSubcategories } from '../../hooks/useCategories';
import { useAws } from '../../hooks/useAws';

type StatusFilter = 'all' | 'unassigned' | 'assigned' | 'archived';

interface AssociateItemDialogProps {
  open: boolean;
  image: BusinessImage | null;
  onClose: () => void;
  onAssociated: () => void;
}

const AssociateItemDialog: React.FC<AssociateItemDialogProps> = ({
  open,
  image,
  onClose,
  onAssociated,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { results, loading, error, search } = useBusinessItemSearch();
  const { associateImageToItem } = useBusinessImages();
  const [input, setInput] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setSelectedSku(null);
    }
  }, [open]);

  const handleSearchChange = async (value: string) => {
    setInput(value);
    await search(value);
  };

  const handleConfirm = async () => {
    if (!image || !selectedSku) {
      enqueueSnackbar(
        t('business.images.associate.selectItem', 'Please select an item'),
        { variant: 'warning' }
      );
      return;
    }
    try {
      await associateImageToItem(image.id, selectedSku);
      enqueueSnackbar(
        t(
          'business.images.associate.success',
          'Image associated with item successfully'
        ),
        { variant: 'success' }
      );
      onAssociated();
      onClose();
    } catch {
      enqueueSnackbar(
        t(
          'business.images.associate.error',
          'Failed to associate image with item'
        ),
        { variant: 'error' }
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('business.images.associate.title', 'Associate image with item')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {image && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
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
                  {t('business.images.associate.imageId', {
                    defaultValue: 'Image {{id}}',
                    id: image.id.slice(0, 8),
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {image.caption ||
                    t(
                      'business.images.associate.noCaption',
                      'No caption provided'
                    )}
                </Typography>
              </Box>
            </Box>
          )}

          <TextField
            fullWidth
            label={t(
              'business.images.associate.searchLabel',
              'Search items by name or SKU'
            )}
            value={input}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {error && (
            <Alert severity="error">
              {t(
                'business.images.associate.searchError',
                'Failed to search items'
              )}
            </Alert>
          )}

          {!loading && !error && results.length === 0 && input.trim() && (
            <Alert severity="info">
              {t(
                'business.images.associate.noResults',
                'No items match your search'
              )}
            </Alert>
          )}

          {!loading && results.length > 0 && (
            <Stack spacing={1}>
              {results.map((item) => (
                <Paper
                  key={item.id}
                  variant={selectedSku === item.sku ? 'outlined' : 'elevation'}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderRadius: 1.5,
                    borderColor:
                      selectedSku === item.sku ? 'primary.main' : 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => setSelectedSku(item.sku || null)}
                >
                  <Typography variant="subtitle2">
                    {item.name}{' '}
                    {item.sku && (
                      <Chip
                        size="small"
                        label={`SKU: ${item.sku}`}
                        sx={{ ml: 1 }}
                        icon={<TagIcon fontSize="small" />}
                      />
                    )}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selectedSku}
        >
          {t('business.images.associate.confirm', 'Associate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const BusinessImagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading, error: profileError } =
    useUserProfileContext();
  const {
    images,
    total,
    page,
    pageSize,
    loading,
    submitting,
    error,
    fetchImages,
    bulkCreateImages,
    updateImage,
    deleteImage,
    removeTag,
    cleanupImage,
    setPage,
    setPageSize,
  } = useBusinessImages();
  const { categories } = useCategories();
  const { subcategories } = useSubcategories();
  const { generateImageUploadUrl } = useAws();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>('all');
  const [uploadCategoryId, setUploadCategoryId] = useState<string>('');
  const [uploadSubcategoryId, setUploadSubcategoryId] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [imageToAssociate, setImageToAssociate] = useState<BusinessImage | null>(
    null
  );
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const [altEdits, setAltEdits] = useState<Record<string, string>>({});
  const [imageToDelete, setImageToDelete] = useState<BusinessImage | null>(null);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);
  const [imageToView, setImageToView] = useState<BusinessImage | null>(null);
  const [imageToCleanup, setImageToCleanup] = useState<BusinessImage | null>(
    null
  );
  const [cleanedB64, setCleanedB64] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [imageCategoryFilters, setImageCategoryFilters] = useState<
    Record<string, string>
  >({});

  const bucketName = useMemo(
    () => process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
    []
  );

  const effectiveStatusFilter = useMemo(
    () => (statusFilter === 'all' ? undefined : statusFilter),
    [statusFilter]
  );

  const filterCategoryNumeric = useMemo(() => {
    if (filterCategoryId === 'all') {
      return null;
    }
    const parsed = parseInt(filterCategoryId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [filterCategoryId]);

  const uploadCategoryNumeric = useMemo(() => {
    if (!uploadCategoryId) {
      return null;
    }
    const parsed = parseInt(uploadCategoryId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [uploadCategoryId]);

  const filterSubcategoryOptions = useMemo(
    () =>
      filterCategoryNumeric == null
        ? subcategories
        : subcategories.filter(
            (sc) => sc.item_category_id === filterCategoryNumeric
          ),
    [subcategories, filterCategoryNumeric]
  );

  const uploadSubcategoryOptions = useMemo(
    () =>
      uploadCategoryNumeric == null
        ? subcategories
        : subcategories.filter(
            (sc) => sc.item_category_id === uploadCategoryNumeric
          ),
    [subcategories, uploadCategoryNumeric]
  );

  const effectiveSubcategoryFilter = useMemo(() => {
    if (filterSubcategoryId === 'all') {
      return undefined;
    }
    const parsed = parseInt(filterSubcategoryId, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [filterSubcategoryId]);

  useEffect(() => {
    fetchImages({
      page,
      pageSize,
      sub_category_id: effectiveSubcategoryFilter ?? undefined,
      status: effectiveStatusFilter,
      search: search || undefined,
    });
  }, [
    fetchImages,
    page,
    pageSize,
    effectiveSubcategoryFilter,
    effectiveStatusFilter,
    search,
  ]);

  useEffect(() => {
    if (!imageToCleanup) return;
    let cancelled = false;
    cleanupImage(imageToCleanup.id).then((result) => {
      if (!cancelled && result?.b64_json) {
        setCleanedB64(result.b64_json);
      }
      if (!cancelled) setCleanupLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [imageToCleanup, cleanupImage]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      return;
    }
    setImageUrls((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    );
    setUrlInput('');
  };

  const removeUrl = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const removeFileAtIndex = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFileToS3 = async (file: File) => {
    const presigned = await generateImageUploadUrl({
      bucketName,
      originalFileName: file.name,
      contentType: file.type,
      prefix: `businesses/${profile?.business?.id || 'unknown'}/images`,
    });
    if (!presigned || !presigned.success || !presigned.data) {
      throw new Error(
        t(
          'business.images.upload.presignError',
          'Failed to prepare image upload'
        )
      );
    }
    await axios.put(presigned.data.url, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
    const imageUrl = `https://${bucketName}.s3.amazonaws.com/${presigned.data.key}`;
    return {
      image_url: imageUrl,
      s3_key: presigned.data.key,
      file_size: file.size,
      format: file.type,
    };
  };

  const handleSaveUploads = async () => {
    if (!selectedFiles.length && !imageUrls.length) {
      enqueueSnackbar(
        t(
          'business.images.upload.nothingSelected',
          'Please select files or add image URLs first'
        ),
        { variant: 'warning' }
      );
      return;
    }
    if (!profile?.business?.id) {
      enqueueSnackbar(
        t(
          'business.images.upload.noBusiness',
          'You need a business profile to upload images'
        ),
        { variant: 'error' }
      );
      return;
    }
    try {
      const uploaded: {
        image_url: string;
        s3_key?: string | null;
        file_size?: number | null;
        format?: string | null;
      }[] = [];

      for (const file of selectedFiles) {
        const result = await uploadFileToS3(file);
        uploaded.push(result);
      }
      imageUrls.forEach((url) => {
        uploaded.push({
          image_url: url,
        });
      });

      const subCategoryId =
        uploadSubcategoryId === ''
          ? null
          : Number.parseInt(uploadSubcategoryId, 10) || null;

      await bulkCreateImages({
        sub_category_id: subCategoryId,
        images: uploaded,
      });

      setSelectedFiles([]);
      setImageUrls([]);
      enqueueSnackbar(
        t(
          'business.images.upload.success',
          'Images added to your library successfully'
        ),
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t(
            'business.images.upload.error',
            'Failed to upload one or more images'
          ),
        { variant: 'error' }
      );
    }
  };

  const handleOpenAssociateDialog = (img: BusinessImage) => {
    setImageToAssociate(img);
    setAssociateDialogOpen(true);
  };

  const handleCloseAssociateDialog = () => {
    setAssociateDialogOpen(false);
    setImageToAssociate(null);
  };

  const handleConfirmDelete = async () => {
    if (!imageToDelete) return;
    setDeleteConfirmLoading(true);
    try {
      await deleteImage(imageToDelete.id);
      enqueueSnackbar(
        t('business.images.delete.success', 'Image deleted successfully'),
        { variant: 'success' }
      );
      setImageToDelete(null);
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('business.images.delete.error', 'Failed to delete image'),
        { variant: 'error' }
      );
    } finally {
      setDeleteConfirmLoading(false);
    }
  };

  const handleSubcategoryChange = async (
    img: BusinessImage,
    subCategoryId: string
  ) => {
    const value =
      subCategoryId === '' ? null : parseInt(subCategoryId, 10) || null;
    try {
      await updateImage(img.id, { sub_category_id: value });
      enqueueSnackbar(
        t('business.images.update.success', 'Image updated successfully'),
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('business.images.update.error', 'Failed to update image'),
        { variant: 'error' }
      );
    }
  };

  const handleRemoveTag = async (img: BusinessImage, tag: string) => {
    try {
      await removeTag(img.id, tag);
      enqueueSnackbar(
        t('business.images.removeTag.success', 'Tag removed'),
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('business.images.removeTag.error', 'Failed to remove tag'),
        { variant: 'error' }
      );
    }
  };

  const handleReplaceImageFile = async (
    img: BusinessImage,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const uploaded = await uploadFileToS3(file);
      await updateImage(img.id, uploaded);
      enqueueSnackbar(
        t(
          'business.images.replace.success',
          'Image file updated successfully'
        ),
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('business.images.replace.error', 'Failed to update image file'),
        { variant: 'error' }
      );
    } finally {
      event.target.value = '';
    }
  };

  const handleRefresh = () => {
    fetchImages({
      page,
      pageSize,
      sub_category_id: effectiveSubcategoryFilter ?? undefined,
      status: effectiveStatusFilter,
    });
  };

  const handleOpenCleanup = (img: BusinessImage) => {
    if (img.is_ai_cleaned) {
      enqueueSnackbar(
        t(
          'business.images.cleanup.alreadyCleaned',
          'Image was already cleaned with AI'
        ),
        { variant: 'info' }
      );
      return;
    }
    setImageToCleanup(img);
    setCleanedB64(null);
    setCleanupLoading(true);
  };

  const handleCleanupAccept = async () => {
    if (!imageToCleanup || !cleanedB64) return;
    try {
      const byteCharacters = atob(cleanedB64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const file = new File([blob], 'cleaned-image.png', { type: 'image/png' });
      const uploaded = await uploadFileToS3(file);
      await updateImage(imageToCleanup.id, {
        ...uploaded,
        is_ai_cleaned: true,
      });
      enqueueSnackbar(
        t(
          'business.images.cleanup.success',
          'Image replaced with cleaned version'
        ),
        { variant: 'success' }
      );
      setImageToCleanup(null);
      setCleanedB64(null);
      handleRefresh();
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('business.images.cleanup.error', 'Failed to cleanup image'),
        { variant: 'error' }
      );
    }
  };

  const handleCleanupReject = () => {
    setImageToCleanup(null);
    setCleanedB64(null);
  };

  const handleEditCaptionAlt = async (
    img: BusinessImage,
    caption: string,
    alt: string
  ) => {
    try {
      await updateImage(img.id, {
        caption,
        alt_text: alt,
      });
      enqueueSnackbar(
        t('business.images.update.success', 'Image updated successfully'),
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('business.images.update.error', 'Failed to update image'),
        { variant: 'error' }
      );
    }
  };

  if (profileLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 320,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (profileError) {
    return (
      <Alert severity="error">
        {t('common.errorLoadingData', 'Error loading data')}: {profileError}
      </Alert>
    );
  }

  if (!profile?.business) {
    return (
      <Alert severity="error">
        {t(
          'business.images.noBusiness',
          'You need a business profile to manage images.'
        )}
      </Alert>
    );
  }

  const filteredImages = images;

  return (
    <Box sx={{ mt: 0, mb: 0 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon color="error" />
            {t(
              'business.images.title',
              'Item Images Library'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.images.subtitle',
              'Bulk upload, organize, and connect images to your items.'
            )}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error">
            {t(
              'business.images.loadError',
              'Failed to load images for your business.'
            )}
          </Alert>
        )}

        {/* Filters and actions */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel>
              {t(
                'business.images.filters.category',
                'Filter by category'
              )}
            </InputLabel>
            <Select
              label={t(
                'business.images.filters.category',
                'Filter by category'
              )}
              value={filterCategoryId}
              onChange={(e) => {
                setFilterCategoryId(e.target.value);
                setFilterSubcategoryId('all');
              }}
            >
              <MenuItem value="all">
                {t(
                  'business.images.filters.allCategories',
                  'All categories'
                )}
              </MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel>
              {t(
                'business.images.filters.subcategory',
                'Filter by subcategory'
              )}
            </InputLabel>
            <Select
              label={t(
                'business.images.filters.subcategory',
                'Filter by subcategory'
              )}
              value={filterSubcategoryId}
              onChange={(e) => setFilterSubcategoryId(e.target.value)}
            >
              <MenuItem value="all">
                {t('business.images.filters.allSubcategories', 'All subcategories')}
              </MenuItem>
              {filterSubcategoryOptions.map((sc) => (
                <MenuItem key={sc.id} value={String(sc.id)}>
                  {sc.item_category?.name
                    ? `${sc.item_category.name} – ${sc.name}`
                    : sc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 160 }} size="small">
            <InputLabel>
              {t('business.images.filters.status', 'Status')}
            </InputLabel>
            <Select
              label={t('business.images.filters.status', 'Status')}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
            >
              <MenuItem value="all">
                {t('business.images.filters.allStatuses', 'All statuses')}
              </MenuItem>
              <MenuItem value="unassigned">
                {t('business.images.status.unassigned', 'Unassigned')}
              </MenuItem>
              <MenuItem value="assigned">
                {t('business.images.status.assigned', 'Assigned')}
              </MenuItem>
              <MenuItem value="archived">
                {t('business.images.status.archived', 'Archived')}
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            sx={{ minWidth: 220, flexGrow: 1 }}
            label={t(
              'business.images.filters.search',
              'Search images'
            )}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applySearch();
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={applySearch}
                    disabled={!searchInput.trim() && !search}
                  >
                    <SearchIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            {t('business.images.actions.refresh', 'Refresh')}
          </Button>
        </Paper>

        {/* Upload section */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1.3fr' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t(
                'business.images.upload.stepTitle',
                '1. Choose subcategory and upload images'
              )}
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    'business.images.upload.categoryLabel',
                    'Category for new images'
                  )}
                </InputLabel>
                <Select
                  label={t(
                    'business.images.upload.categoryLabel',
                    'Category for new images'
                  )}
                  value={uploadCategoryId}
                  onChange={(e) => {
                    setUploadCategoryId(e.target.value);
                    setUploadSubcategoryId('');
                  }}
                >
                  <MenuItem value="">
                    {t(
                      'business.images.upload.noCategory',
                      'All categories'
                    )}
                  </MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    'business.images.upload.subcategoryLabel',
                    'Subcategory for new images'
                  )}
                </InputLabel>
                <Select
                  label={t(
                    'business.images.upload.subcategoryLabel',
                    'Subcategory for new images'
                  )}
                  value={uploadSubcategoryId}
                  onChange={(e) => setUploadSubcategoryId(e.target.value)}
                >
                  <MenuItem value="">
                    {t(
                      'business.images.upload.noSubcategory',
                      'No specific subcategory'
                    )}
                  </MenuItem>
                  {uploadSubcategoryOptions.map((sc) => (
                    <MenuItem key={sc.id} value={String(sc.id)}>
                      {sc.item_category?.name
                        ? `${sc.item_category.name} – ${sc.name}`
                        : sc.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t(
                  'business.images.upload.selectFiles',
                  'Select image files'
                )}
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </Button>

              {selectedFiles.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'business.images.upload.selectedCount',
                      '{{count}} file(s) selected',
                      { count: selectedFiles.length }
                    )}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                    }}
                  >
                    {selectedFiles.map((file, index) => (
                      <Chip
                        key={`${file.name}-${index}`}
                        label={file.name}
                        onDelete={() => removeFileAtIndex(index)}
                        size="small"
                      />
                    ))}
                  </Box>
                </Stack>
              )}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t(
                'business.images.upload.urlStepTitle',
                '2. Or add images by URL'
              )}
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                size="small"
                label={t(
                  'business.images.upload.urlLabel',
                  'Image URL'
                )}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={handleAddUrl}
                        edge="end"
                        disabled={!urlInput.trim()}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {imageUrls.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  {imageUrls.map((url) => (
                    <Chip
                      key={url}
                      label={url}
                      onDelete={() => removeUrl(url)}
                      size="small"
                      icon={<LinkIcon fontSize="small" />}
                    />
                  ))}
                </Box>
              )}
            </Stack>
          </Box>

          <Box
            sx={{
              gridColumn: { xs: '1', md: '1 / -1' },
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              mt: 2,
            }}
          >
            <Button
              variant="contained"
              startIcon={<ImageIcon />}
              onClick={handleSaveUploads}
              disabled={submitting}
            >
              {submitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                t(
                  'business.images.upload.saveButton',
                  'Add images to library'
                )
              )}
            </Button>
          </Box>
        </Paper>

        {/* Images grid */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle1">
              {t('business.images.list.title', 'Your image library')}{' '}
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                ({total}{' '}
                {t('business.images.list.countLabel', 'images total')})
              </Typography>
            </Typography>
          </Stack>

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                py: 4,
              }}
            >
              <CircularProgress />
            </Box>
          ) : !filteredImages.length ? (
            <Alert severity="info">
              {t(
                'business.images.list.empty',
                'No images yet. Upload files or add image URLs to get started.'
              )}
            </Alert>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(1, minmax(0, 1fr))',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: 2,
                }}
              >
                {filteredImages.map((img) => {
                  const skuTags = (img.tags || []).filter((tag) =>
                    tag.startsWith('sku:')
                  );
                  const otherTags = (img.tags || []).filter(
                    (tag) => !tag.startsWith('sku:')
                  );
                  const captionValue =
                    captionEdits[img.id] ?? img.caption ?? '';
                  const altValue = altEdits[img.id] ?? img.alt_text ?? '';
                  const existingSubcategory =
                    img.sub_category_id != null
                      ? subcategories.find(
                          (sc) => sc.id === img.sub_category_id
                        )
                      : undefined;
                  const cardCategoryId =
                    imageCategoryFilters[img.id] ??
                    (existingSubcategory
                      ? String(existingSubcategory.item_category_id)
                      : '');
                  const cardSubcategoryOptions =
                    cardCategoryId && cardCategoryId !== ''
                      ? subcategories.filter(
                          (sc) =>
                            sc.item_category_id ===
                            parseInt(cardCategoryId, 10)
                        )
                      : subcategories;

                  return (
                    <Card key={img.id} variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardMedia
                        component="img"
                        height="160"
                        image={img.image_url}
                        alt={img.alt_text || ''}
                        sx={{
                          objectFit: 'cover',
                          cursor: 'pointer',
                        }}
                        onClick={() => setImageToView(img)}
                      />
                      <CardContent sx={{ pb: 1 }}>
                        <Stack spacing={1}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            flexWrap="wrap"
                            gap={0.5}
                          >
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              <Chip
                                size="small"
                                label={t(
                                  `business.images.status.${img.status}`,
                                  img.status
                                )}
                                color={
                                  img.status === 'assigned'
                                    ? 'success'
                                    : img.status === 'archived'
                                    ? 'default'
                                    : 'warning'
                                }
                              />
                              {(img.is_ai_cleaned ||
                                (img.tags || []).includes('ai-cleaned')) && (
                                <Chip
                                  size="small"
                                  label={t(
                                    'business.images.tagAiCleaned',
                                    'AI cleaned'
                                  )}
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(img.created_at).toLocaleDateString()}
                            </Typography>
                          </Stack>

                          <FormControl fullWidth size="small">
                            <InputLabel>
                              {t(
                                'business.images.fields.category',
                                'Category'
                              )}
                            </InputLabel>
                            <Select
                              label={t(
                                'business.images.fields.category',
                                'Category'
                              )}
                              value={cardCategoryId}
                              onChange={(e) =>
                                setImageCategoryFilters((prev) => ({
                                  ...prev,
                                  [img.id]: e.target.value,
                                }))
                              }
                              disabled={submitting}
                            >
                              <MenuItem value="">
                                {t(
                                  'business.images.upload.noCategory',
                                  'All categories'
                                )}
                              </MenuItem>
                              {categories.map((cat) => (
                                <MenuItem key={cat.id} value={String(cat.id)}>
                                  {cat.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl fullWidth size="small">
                            <InputLabel>
                              {t(
                                'business.images.fields.subcategory',
                                'Subcategory'
                              )}
                            </InputLabel>
                            <Select
                              label={t(
                                'business.images.fields.subcategory',
                                'Subcategory'
                              )}
                              value={
                                img.sub_category_id != null
                                  ? String(img.sub_category_id)
                                  : ''
                              }
                              onChange={(e) =>
                                handleSubcategoryChange(img, e.target.value)
                              }
                              disabled={submitting}
                            >
                              <MenuItem value="">
                                {t(
                                  'business.images.upload.noSubcategory',
                                  'No specific subcategory'
                                )}
                              </MenuItem>
                              {cardSubcategoryOptions.map((sc) => (
                                <MenuItem key={sc.id} value={String(sc.id)}>
                                  {sc.item_category?.name
                                    ? `${sc.item_category.name} – ${sc.name}`
                                    : sc.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <TextField
                            size="small"
                            fullWidth
                            label={t(
                              'business.images.fields.caption',
                              'Caption'
                            )}
                            value={captionValue}
                          onChange={(e) =>
                            setCaptionEdits((prev) => ({
                              ...prev,
                              [img.id]: e.target.value,
                            }))
                          }
                            onBlur={() =>
                              handleEditCaptionAlt(
                                img,
                                captionValue,
                                altValue
                              )
                            }
                          />
                          <TextField
                            size="small"
                            fullWidth
                            label={t(
                              'business.images.fields.altText',
                              'Alt text'
                            )}
                            value={altValue}
                          onChange={(e) =>
                            setAltEdits((prev) => ({
                              ...prev,
                              [img.id]: e.target.value,
                            }))
                          }
                            onBlur={() =>
                              handleEditCaptionAlt(
                                img,
                                captionValue,
                                altValue
                              )
                            }
                          />

                          {(skuTags.length > 0 || otherTags.length > 0) && (
                            <Stack direction="row" flexWrap="wrap" gap={0.5}>
                              {skuTags.map((tag) => (
                                <Chip
                                  key={tag}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  icon={<TagIcon fontSize="small" />}
                                  label={tag.replace('sku:', 'SKU: ').toUpperCase()}
                                  onDelete={() => handleRemoveTag(img, tag)}
                                  disabled={submitting}
                                />
                              ))}
                              {otherTags.map((tag) => (
                                <Chip
                                  key={tag}
                                  size="small"
                                  label={tag}
                                  variant="outlined"
                                  onDelete={() => handleRemoveTag(img, tag)}
                                  disabled={submitting}
                                />
                              ))}
                            </Stack>
                          )}
                        </Stack>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2 }}>
                        <Stack spacing={1} sx={{ width: '100%' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SearchIcon />}
                            onClick={() => handleOpenAssociateDialog(img)}
                            disabled={submitting}
                            fullWidth
                          >
                            {t(
                              'business.images.actions.associateItem',
                              'Associate item'
                            )}
                          </Button>
                          {profile?.business?.image_cleanup_enabled && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AutoFixHighIcon />}
                              onClick={() => handleOpenCleanup(img)}
                              disabled={submitting || img.is_ai_cleaned}
                              fullWidth
                            >
                              {t(
                                'business.images.actions.cleanup',
                                'Cleanup picture'
                              )}
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="text"
                            component="label"
                            disabled={submitting}
                            startIcon={<CloudUploadIcon fontSize="small" />}
                            fullWidth
                          >
                            {t(
                              'business.images.actions.replace',
                              'Replace image'
                            )}
                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              onChange={(e) => handleReplaceImageFile(img, e)}
                            />
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={() => setImageToDelete(img)}
                            disabled={submitting}
                            fullWidth
                          >
                            {t('business.images.actions.delete', 'Delete image')}
                          </Button>
                        </Stack>
                      </CardActions>
                    </Card>
                  );
                })}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 2,
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Pagination
                  count={Math.max(1, Math.ceil(total / pageSize))}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                />
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>
                    {t('business.images.pagination.pageSize', 'Per page')}
                  </InputLabel>
                  <Select
                    label={t(
                      'business.images.pagination.pageSize',
                      'Per page'
                    )}
                    value={pageSize}
                    onChange={(e) =>
                      handlePageSizeChange(Number(e.target.value) || 20)
                    }
                  >
                    {[12, 24, 48].map((size) => (
                      <MenuItem key={size} value={size}>
                        {size}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </>
          )}
        </Paper>
      </Stack>

      <AssociateItemDialog
        open={associateDialogOpen}
        image={imageToAssociate}
        onClose={handleCloseAssociateDialog}
        onAssociated={handleRefresh}
      />

      <ConfirmationModal
        open={imageToDelete != null}
        title={t('business.images.delete.confirmTitle', 'Delete image')}
        message={t(
          'business.images.delete.confirmMessage',
          'Are you sure you want to delete this image? This cannot be undone.'
        )}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmColor="error"
        loading={deleteConfirmLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setImageToDelete(null)}
      />

      {/* Image view lightbox */}
      <Dialog
        open={imageToView != null}
        onClose={() => setImageToView(null)}
        maxWidth={false}
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            maxWidth: '90vw',
            bgcolor: 'transparent',
            boxShadow: 'none',
          },
        }}
        slotProps={{
          backdrop: {
            sx: { bgcolor: 'rgba(0,0,0,0.85)' },
          },
        }}
        onClick={() => setImageToView(null)}
      >
        <IconButton
          aria-label="close"
          onClick={() => setImageToView(null)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 1,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          sx={{
            p: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {imageToView && (
            <Box
              component="img"
              src={imageToView.image_url}
              alt={imageToView.alt_text || ''}
              sx={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ImageCleanupPreviewDialog
        open={imageToCleanup != null}
        onClose={() => {
          setImageToCleanup(null);
          setCleanedB64(null);
        }}
        originalUrl={imageToCleanup?.image_url ?? ''}
        cleanedB64={cleanedB64}
        loading={cleanupLoading}
        onAccept={handleCleanupAccept}
        onReject={handleCleanupReject}
      />
    </Box>
  );
};

export default BusinessImagesPage;

