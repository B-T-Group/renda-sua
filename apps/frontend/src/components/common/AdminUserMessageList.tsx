import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
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
import type { UserMessage } from '../../hooks/useAdminUserMessages';

interface AdminUserMessageListProps {
  messages: UserMessage[];
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

const AdminUserMessageList: React.FC<AdminUserMessageListProps> = ({
  messages,
  loading,
  error,
  pagination,
  onLoadPage,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'order':
        return 'primary';
      case 'agent':
        return 'success';
      case 'client':
        return 'info';
      case 'business':
        return 'warning';
      default:
        return 'default';
    }
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

  if (messages.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          {t('admin.noMessages', 'No messages found for this user')}
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
              <TableCell>
                {t('admin.messages.entityType', 'Entity Type')}
              </TableCell>
              <TableCell>{t('admin.messages.entityId', 'Entity ID')}</TableCell>
              <TableCell>{t('admin.messages.message', 'Message')}</TableCell>
              <TableCell>
                {t('admin.messages.createdAt', 'Created At')}
              </TableCell>
              <TableCell>
                {t('admin.messages.updatedAt', 'Updated At')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <Chip
                    label={message.entity_type}
                    color={getEntityTypeColor(message.entity_type) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {message.entity_id}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300 }}>
                    {message.message}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(message.created_at)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(message.updated_at)}
                  </Typography>
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

export default AdminUserMessageList;
