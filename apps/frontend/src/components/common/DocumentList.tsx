import {
  Clear,
  Delete,
  Download,
  Edit,
  FilterList,
  Refresh,
  Search,
  Visibility,
} from '@mui/icons-material';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useDocumentDelete } from '../../hooks/useDocumentDelete';
import {
  DocumentFilters,
  DocumentType,
  UserDocument,
} from '../../hooks/useDocumentManagement';
import { useDocumentPreview } from '../../hooks/useDocumentPreview';

interface DocumentListProps {
  documents: UserDocument[];
  documentTypes: DocumentType[];
  loading: boolean;
  error: string | null;
  onDelete: (documentId: string) => Promise<boolean>;
  onUpdateNote: (documentId: string, note: string) => Promise<boolean>;
  onRefresh: (filters?: DocumentFilters) => void;
  className?: string;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  documentTypes,
  loading,
  error,
  onDelete,
  onUpdateNote,
  onRefresh,
  className,
}) => {
  const {
    getDocumentPreviewUrl,
    loading: previewLoading,
    error: previewError,
  } = useDocumentPreview();

  const {
    deleteDocument: deleteDocumentApi,
    loading: deleteLoading,
    error: deleteError,
  } = useDocumentDelete();
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<number | ''>(
    ''
  );
  const [approvalFilter, setApprovalFilter] = useState<boolean | ''>('');
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    document: UserDocument | null;
    previewUrl: string | null;
  }>({
    open: false,
    document: null,
    previewUrl: null,
  });
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    document: UserDocument | null;
    note: string;
  }>({
    open: false,
    document: null,
    note: '',
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    document: UserDocument | null;
  }>({
    open: false,
    document: null,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string): string => {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('word') || contentType.includes('document'))
      return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet'))
      return '📊';
    if (
      contentType.includes('powerpoint') ||
      contentType.includes('presentation')
    )
      return '📈';
    if (contentType.includes('zip') || contentType.includes('rar')) return '📦';
    return '📎';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFilterChange = useCallback(() => {
    const newFilters: DocumentFilters = {};

    if (searchTerm) newFilters.search = searchTerm;
    if (selectedDocumentType)
      newFilters.document_type_id = selectedDocumentType;
    if (approvalFilter !== '') newFilters.is_approved = approvalFilter;

    setFilters(newFilters);
    onRefresh(newFilters);
  }, [searchTerm, selectedDocumentType, approvalFilter, onRefresh]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedDocumentType('');
    setApprovalFilter('');
    setFilters({});
    onRefresh();
  }, [onRefresh]);

  const handlePreview = useCallback(
    async (document: UserDocument) => {
      setPreviewDialog({ open: true, document, previewUrl: null });

      // Get presigned URL from backend
      const previewUrl = await getDocumentPreviewUrl(document.id);
      if (previewUrl) {
        setPreviewDialog({ open: true, document, previewUrl });
      }
    },
    [getDocumentPreviewUrl]
  );

  const handleEdit = useCallback((document: UserDocument) => {
    setEditDialog({ open: true, document, note: document.note || '' });
  }, []);

  const handleDelete = useCallback((document: UserDocument) => {
    setDeleteDialog({ open: true, document });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog.document) return;

    const success = await deleteDocumentApi(deleteDialog.document.id);
    if (success) {
      setDeleteDialog({ open: false, document: null });
      // Refresh the documents list after successful deletion
      onRefresh(filters);
    }
  }, [deleteDialog.document, deleteDocumentApi, onRefresh, filters]);

  const handleConfirmEdit = useCallback(async () => {
    if (!editDialog.document) return;

    const success = await onUpdateNote(editDialog.document.id, editDialog.note);
    if (success) {
      setEditDialog({ open: false, document: null, note: '' });
    }
  }, [editDialog.document, editDialog.note, onUpdateNote]);

  const handleDownload = useCallback(
    async (document: UserDocument) => {
      // Get presigned URL from backend for download
      const downloadUrl = await getDocumentPreviewUrl(document.id);
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }
    },
    [getDocumentPreviewUrl]
  );

  const filteredDocuments = documents.filter((doc) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        doc.file_name.toLowerCase().includes(searchLower) ||
        (doc.note && doc.note.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  return (
    <Box className={className}>
      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filters
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search files"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <Search sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Document Type</InputLabel>
              <Select
                value={selectedDocumentType}
                label="Document Type"
                onChange={(e) =>
                  setSelectedDocumentType(e.target.value as number)
                }
              >
                <MenuItem value="">All Types</MenuItem>
                {documentTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={approvalFilter}
                label="Status"
                onChange={(e) =>
                  setApprovalFilter(e.target.value as boolean | '')
                }
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Approved</MenuItem>
                <MenuItem value="false">Pending</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={handleFilterChange}
              startIcon={<FilterList />}
            >
              Apply Filters
            </Button>

            <Button
              variant="outlined"
              onClick={handleClearFilters}
              startIcon={<Clear />}
            >
              Clear
            </Button>

            <Button
              variant="outlined"
              onClick={() => onRefresh(filters)}
              startIcon={<Refresh />}
            >
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Documents Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Documents ({filteredDocuments.length})
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>File</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Uploaded</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // Loading skeletons
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton width={200} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width={100} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width={80} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width={80} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width={120} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width={150} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width={120} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">
                        No documents found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((document) => (
                    <TableRow key={document.id} hover>
                      <TableCell>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Typography variant="h6">
                            {getFileIcon(document.content_type)}
                          </Typography>
                          <Typography variant="body2" noWrap>
                            {document.file_name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={document.document_type.description}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatFileSize(document.file_size)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Badge
                          badgeContent={
                            document.is_approved ? 'Approved' : 'Pending'
                          }
                          color={document.is_approved ? 'success' : 'warning'}
                          sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(document.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 200 }}
                        >
                          {document.note || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="center"
                        >
                          <Tooltip title="Preview">
                            <IconButton
                              size="small"
                              onClick={() => handlePreview(document)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(document)}
                            >
                              <Download />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Edit Note">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(document)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(document)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={() =>
          setPreviewDialog({ open: false, document: null, previewUrl: null })
        }
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Preview: {previewDialog.document?.file_name}</DialogTitle>
        <DialogContent>
          {previewDialog.document && (
            <Box>
              {previewLoading ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography>Loading preview...</Typography>
                </Box>
              ) : previewError ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography color="error" sx={{ mb: 2 }}>
                    Error loading preview: {previewError}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => handleDownload(previewDialog.document!)}
                  >
                    Download to View
                  </Button>
                </Box>
              ) : previewDialog.previewUrl ? (
                previewDialog.document.content_type.startsWith('image/') ? (
                  <img
                    src={previewDialog.previewUrl}
                    alt={previewDialog.document.file_name}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                ) : (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ mb: 2 }}>
                      {getFileIcon(previewDialog.document.content_type)}
                    </Typography>
                    <Typography variant="body1">
                      Preview not available for this file type.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => handleDownload(previewDialog.document!)}
                      sx={{ mt: 2 }}
                    >
                      Download to View
                    </Button>
                  </Box>
                )
              ) : (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography>Loading preview...</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setPreviewDialog({
                open: false,
                document: null,
                previewUrl: null,
              })
            }
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, document: null, note: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Note: {editDialog.document?.file_name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Note"
            value={editDialog.note}
            onChange={(e) =>
              setEditDialog((prev) => ({ ...prev, note: e.target.value }))
            }
            multiline
            rows={3}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setEditDialog({ open: false, document: null, note: '' })
            }
          >
            Cancel
          </Button>
          <Button onClick={handleConfirmEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, document: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.document?.file_name}
            "? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, document: null })}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
