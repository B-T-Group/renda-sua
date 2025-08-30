import { Download, Visibility } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserUpload } from '../../hooks/useAdminUserUploads';

interface AdminUserUploadListProps {
  uploads: UserUpload[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onLoadPage: (page: number) => void;
  onRefresh: () => void;
}

const AdminUserUploadList: React.FC<AdminUserUploadListProps> = ({
  uploads,
  loading,
  error,
  pagination,
  onLoadPage,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (isApproved: boolean) => {
    return isApproved ? 'success' : 'warning';
  };

  const getFileUrl = (key: string) => {
    // Construct S3 URL from key - you may need to adjust this based on your S3 configuration
    return `https://your-s3-bucket.s3.amazonaws.com/${key}`;
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    onLoadPage(newPage + 1);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    // Note: This would need to be handled by the parent component
  };

  const handleViewFile = (upload: UserUpload) => {
    const fileUrl = getFileUrl(upload.key);
    window.open(fileUrl, '_blank');
  };

  const handleDownloadFile = (upload: UserUpload) => {
    const fileUrl = getFileUrl(upload.key);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = upload.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (uploads.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          {t('admin.noUploads', 'No uploads found for this user')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.uploads.fileName', 'File Name')}</TableCell>
              <TableCell>
                {t('admin.uploads.documentType', 'Document Type')}
              </TableCell>
              <TableCell>
                {t('admin.uploads.contentType', 'Content Type')}
              </TableCell>
              <TableCell>{t('admin.uploads.fileSize', 'Size')}</TableCell>
              <TableCell>{t('admin.uploads.status', 'Status')}</TableCell>
              <TableCell>
                {t('admin.uploads.uploadedAt', 'Uploaded At')}
              </TableCell>
              <TableCell>{t('admin.uploads.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {uploads.map((upload) => (
              <TableRow key={upload.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {upload.file_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={upload.document_type.name}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {upload.content_type}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(upload.file_size)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={upload.is_approved ? 'Approved' : 'Pending'}
                    color={getStatusColor(upload.is_approved) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(upload.created_at)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewFile(upload)}
                      title={t('admin.uploads.viewFile', 'View File')}
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDownloadFile(upload)}
                      title={t('admin.uploads.downloadFile', 'Download File')}
                    >
                      <Download />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={pagination.total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage={t('common.rowsPerPage', 'Rows per page:')}
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
        }
      />
    </Box>
  );
};

export default AdminUserUploadList;
