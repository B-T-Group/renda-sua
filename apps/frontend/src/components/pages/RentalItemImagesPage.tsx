import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  AutoFixHigh as AutoFixHighIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Search as SearchIcon,
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
  Tooltip,
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
import {
  CreateRentalFromImageDialog,
  type CreateRentalFromImageEntrySource,
} from '../dialogs/CreateRentalFromImageDialog';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalItemImages,
  type RentalItemImage,
} from '../../hooks/useRentalItemImages';
import { useRentalItemSearch } from '../../hooks/useRentalItemSearch';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import { useAws } from '../../hooks/useAws';

type StatusFilter = 'all' | 'unassigned' | 'assigned' | 'archived';

interface AssociateRentalDialogProps {
  open: boolean;
  image: RentalItemImage | null;
  onClose: () => void;
  onDone: () => void;
  onAssociate: (imageId: string, rentalItemId: string) => Promise<void>;
}

const AssociateRentalDialog: React.FC<AssociateRentalDialogProps> = ({
  open,
  image,
  onClose,
  onDone,
  onAssociate,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { results, loading, error, search } = useRentalItemSearch();
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setSelectedId(null);
    }
  }, [open]);

  const onConfirm = async () => {
    if (!image || !selectedId) {
      enqueueSnackbar(
        t(
          'business.rentalImages.associate.selectItem',
          'Select a rental item'
        ),
        { variant: 'warning' }
      );
      return;
    }
    try {
      await onAssociate(image.id, selectedId);
      enqueueSnackbar(
        t(
          'business.rentalImages.associate.success',
          'Image linked to rental item'
        ),
        { variant: 'success' }
      );
      onDone();
      onClose();
    } catch {
      enqueueSnackbar(
        t(
          'business.rentalImages.associate.error',
          'Failed to link image'
        ),
        { variant: 'error' }
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t(
          'business.rentalImages.associate.title',
          'Link image to rental item'
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label={t(
              'business.rentalImages.associate.searchLabel',
              'Search rental items by name'
            )}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              void search(e.target.value);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading &&
            results.map((row) => (
              <Paper
                key={row.id}
                variant={selectedId === row.id ? 'outlined' : 'elevation'}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  borderColor:
                    selectedId === row.id ? 'primary.main' : 'divider',
                }}
                onClick={() => setSelectedId(row.id)}
              >
                <Typography variant="subtitle2">{row.name}</Typography>
              </Paper>
            ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => void onConfirm()}
          disabled={!selectedId}
        >
          {t('business.rentalImages.associate.confirm', 'Link')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const RentalItemImagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading, error: profileError } =
    useUserProfileContext();
  const { categories } = useRentalCategories();
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
    disassociateFromRentalItem,
    associateToRentalItem,
    updateImage,
    deleteImage,
    cleanupImage,
    setPage,
  } = useRentalItemImages();
  const { generateImageUploadUrl } = useAws();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterCategoryId, setFilterCategoryId] = useState('all');
  const [uploadCategoryId, setUploadCategoryId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [assocOpen, setAssocOpen] = useState(false);
  const [assocImage, setAssocImage] = useState<RentalItemImage | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createImage, setCreateImage] = useState<RentalItemImage | null>(null);
  const [createEntrySource, setCreateEntrySource] =
    useState<CreateRentalFromImageEntrySource>('manual');
  const [delImage, setDelImage] = useState<RentalItemImage | null>(null);
  const [cleanupTarget, setCleanupTarget] = useState<RentalItemImage | null>(
    null
  );
  const [cleanedB64, setCleanedB64] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const bucketName = useMemo(
    () => process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
    []
  );

  const statusParam = statusFilter === 'all' ? undefined : statusFilter;
  const categoryParam =
    filterCategoryId === 'all' ? undefined : filterCategoryId;

  useEffect(() => {
    void fetchImages({
      page,
      pageSize,
      rental_category_id: categoryParam,
      status: statusParam,
      search: search || undefined,
    });
  }, [
    fetchImages,
    page,
    pageSize,
    categoryParam,
    statusParam,
    search,
  ]);

  useEffect(() => {
    if (!cleanupTarget) return;
    let cancelled = false;
    setCleanupLoading(true);
    void cleanupImage(cleanupTarget.id).then((r) => {
      if (!cancelled && r?.b64_json) setCleanedB64(r.b64_json);
      if (!cancelled) setCleanupLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cleanupTarget, cleanupImage]);

  const uploadFileToS3 = async (file: File) => {
    const presigned = await generateImageUploadUrl({
      bucketName,
      originalFileName: file.name,
      contentType: file.type,
      prefix: `businesses/${profile?.business?.id || 'unknown'}/rental-images`,
    });
    if (!presigned?.success || !presigned.data) {
      throw new Error(
        t(
          'business.rentalImages.upload.presignError',
          'Failed to prepare upload'
        )
      );
    }
    await axios.put(presigned.data.url, file, {
      headers: { 'Content-Type': file.type },
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
          'business.rentalImages.upload.nothingSelected',
          'Add files or URLs first'
        ),
        { variant: 'warning' }
      );
      return;
    }
    if (!profile?.business?.id) return;
    try {
      const uploaded: {
        image_url: string;
        s3_key?: string | null;
        file_size?: number | null;
        format?: string | null;
      }[] = [];
      for (const file of selectedFiles) {
        uploaded.push(await uploadFileToS3(file));
      }
      imageUrls.forEach((u) => uploaded.push({ image_url: u }));
      await bulkCreateImages({
        rental_category_id: uploadCategoryId || null,
        images: uploaded,
      });
      setSelectedFiles([]);
      setImageUrls([]);
      enqueueSnackbar(
        t(
          'business.rentalImages.upload.success',
          'Images added to rental library'
        ),
        { variant: 'success' }
      );
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.rentalImages.upload.error', 'Upload failed'),
        { variant: 'error' }
      );
    }
  };

  const openCleanup = (img: RentalItemImage) => {
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
    setCleanupTarget(img);
    setCleanedB64(null);
  };

  const acceptCleanup = async () => {
    if (!cleanupTarget || !cleanedB64) return;
    try {
      const byteCharacters = atob(cleanedB64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: 'image/png',
      });
      const file = new File([blob], 'cleaned.png', { type: 'image/png' });
      const uploaded = await uploadFileToS3(file);
      await updateImage(cleanupTarget.id, {
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
      setCleanupTarget(null);
      setCleanedB64(null);
      void fetchImages({
        page,
        pageSize,
        rental_category_id: categoryParam,
        status: statusParam,
        search: search || undefined,
      });
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.images.cleanup.error', 'Cleanup failed'),
        { variant: 'error' }
      );
    }
  };

  if (profileLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (profileError) {
    return (
      <Alert severity="error">
        {t('common.errorLoadingData', 'Error loading data')}
      </Alert>
    );
  }
  if (!profile?.business) {
    return (
      <Alert severity="error">
        {t(
          'business.rentalImages.noBusiness',
          'A business profile is required.'
        )}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon color="primary" />
            {t(
              'business.rentalImages.title',
              'Rental item image library'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.rentalImages.subtitle',
              'Upload images, then link them to rental items or create new items.'
            )}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              {t('business.rentalImages.upload.title', 'Add images')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
                {t('business.rentalImages.upload.chooseFiles', 'Choose files')}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) =>
                    setSelectedFiles((p) => [
                      ...p,
                      ...Array.from(e.target.files || []),
                    ])
                  }
                />
              </Button>
              <TextField
                size="small"
                label={t('business.rentalImages.upload.url', 'Image URL')}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                onClick={() => {
                  const u = urlInput.trim();
                  if (u) {
                    setImageUrls((p) => (p.includes(u) ? p : [...p, u]));
                    setUrlInput('');
                  }
                }}
              >
                {t('business.rentalImages.upload.addUrl', 'Add URL')}
              </Button>
            </Stack>
            <FormControl size="small" sx={{ maxWidth: 320 }}>
              <InputLabel>
                {t(
                  'business.rentalImages.upload.categoryLabel',
                  'Default category (optional)'
                )}
              </InputLabel>
              <Select
                label={t(
                  'business.rentalImages.upload.categoryLabel',
                  'Default category (optional)'
                )}
                value={uploadCategoryId}
                onChange={(e) => setUploadCategoryId(e.target.value)}
              >
                <MenuItem value="">
                  {t('common.none', 'None')}
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {(selectedFiles.length > 0 || imageUrls.length > 0) && (
              <Typography variant="caption" color="text.secondary">
                {selectedFiles.length + imageUrls.length}{' '}
                {t('business.rentalImages.upload.pending', 'pending')}
              </Typography>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => void handleSaveUploads()}
              disabled={submitting}
            >
              {t('business.rentalImages.upload.save', 'Save to library')}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
          >
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{t('business.rentalImages.filter.status', 'Status')}</InputLabel>
              <Select
                label={t('business.rentalImages.filter.status', 'Status')}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
              >
                <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
                <MenuItem value="unassigned">
                  {t('business.rentalImages.filter.unassigned', 'Unassigned')}
                </MenuItem>
                <MenuItem value="assigned">
                  {t('business.rentalImages.filter.assigned', 'Assigned')}
                </MenuItem>
                <MenuItem value="archived">
                  {t('business.rentalImages.filter.archived', 'Archived')}
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>
                {t('business.rentalImages.filter.category', 'Category')}
              </InputLabel>
              <Select
                label={t('business.rentalImages.filter.category', 'Category')}
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
              >
                <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label={t('common.search', 'Search')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(searchInput.trim());
                  setPage(1);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              onClick={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
            >
              {t('common.apply', 'Apply')}
            </Button>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
            }}
          >
            {images.map((img) => (
              <Card key={img.id} variant="outlined">
                <CardMedia
                  component="img"
                  height="160"
                  image={img.image_url}
                  alt={img.alt_text || ''}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ pb: 1 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={img.status} />
                    {img.is_ai_cleaned && (
                      <Chip size="small" color="secondary" label="AI" />
                    )}
                  </Stack>
                  {img.rental_item && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      {img.rental_item.name}
                    </Typography>
                  )}
                  <TextField
                    size="small"
                    fullWidth
                    sx={{ mt: 1 }}
                    label={t('business.rentalImages.caption', 'Caption')}
                    defaultValue={img.caption || ''}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (img.caption || '')) {
                        void updateImage(img.id, { caption: v });
                      }
                    }}
                  />
                </CardContent>
                <CardActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    aria-label="link"
                    onClick={() => {
                      setAssocImage(img);
                      setAssocOpen(true);
                    }}
                  >
                    <LinkIcon fontSize="small" />
                  </IconButton>
                  {img.rental_item_id && (
                    <IconButton
                      size="small"
                      aria-label="unlink"
                    onClick={() => {
                      void disassociateFromRentalItem(img.id)
                        .then(() =>
                          enqueueSnackbar(
                            t(
                              'business.rentalImages.disassociate.success',
                              'Unlinked from item'
                            ),
                            { variant: 'success' }
                          )
                        )
                        .catch(() =>
                          enqueueSnackbar(
                            t(
                              'business.rentalImages.disassociate.error',
                              'Could not unlink'
                            ),
                            { variant: 'error' }
                          )
                        );
                    }}
                    >
                      <LinkOffIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Tooltip
                    title={t(
                      'business.rentalImages.card.createFromImageAi',
                      'Fill details with AI, then create'
                    )}
                  >
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t(
                          'business.rentalImages.card.createFromImageAi',
                          'Fill details with AI, then create'
                        )}
                        onClick={() => {
                          setCreateImage(img);
                          setCreateEntrySource('ai_prefill');
                          setCreateOpen(true);
                        }}
                        disabled={Boolean(img.rental_item_id)}
                        color="primary"
                      >
                        <AutoAwesomeIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={t(
                      'business.rentalImages.card.createManual',
                      'Create rental item manually'
                    )}
                  >
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t(
                          'business.rentalImages.card.createManual',
                          'Create rental item manually'
                        )}
                        onClick={() => {
                          setCreateImage(img);
                          setCreateEntrySource('manual');
                          setCreateOpen(true);
                        }}
                        disabled={Boolean(img.rental_item_id)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={() => openCleanup(img)}
                    disabled={img.is_ai_cleaned}
                  >
                    <AutoFixHighIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDelImage(img)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <Pagination
            count={Math.max(1, Math.ceil(total / pageSize))}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
          />
        </Box>
      </Stack>

      <AssociateRentalDialog
        open={assocOpen}
        image={assocImage}
        onAssociate={associateToRentalItem}
        onClose={() => {
          setAssocOpen(false);
          setAssocImage(null);
        }}
        onDone={() =>
          void fetchImages({
            page,
            pageSize,
            rental_category_id: categoryParam,
            status: statusParam,
            search: search || undefined,
          })
        }
      />

      <CreateRentalFromImageDialog
        open={createOpen}
        image={createImage}
        entrySource={createEntrySource}
        categories={categories}
        onClose={() => {
          setCreateOpen(false);
          setCreateImage(null);
        }}
        onCreated={() =>
          void fetchImages({
            page,
            pageSize,
            rental_category_id: categoryParam,
            status: statusParam,
            search: search || undefined,
          })
        }
      />

      <ConfirmationModal
        open={Boolean(delImage)}
        title={t('business.rentalImages.delete.title', 'Delete image?')}
        message={t(
          'business.rentalImages.delete.message',
          'This cannot be undone.'
        )}
        onCancel={() => setDelImage(null)}
        onConfirm={async () => {
          if (!delImage) return;
          try {
            await deleteImage(delImage.id);
            enqueueSnackbar(
              t('business.rentalImages.delete.success', 'Deleted'),
              { variant: 'success' }
            );
          } finally {
            setDelImage(null);
          }
        }}
      />

      <ImageCleanupPreviewDialog
        open={Boolean(cleanupTarget)}
        onClose={() => {
          setCleanupTarget(null);
          setCleanedB64(null);
        }}
        originalUrl={cleanupTarget?.image_url || ''}
        cleanedB64={cleanedB64}
        loading={cleanupLoading}
        onAccept={() => void acceptCleanup()}
        onReject={() => {
          setCleanupTarget(null);
          setCleanedB64(null);
        }}
      />
    </Box>
  );
};

export default RentalItemImagesPage;
