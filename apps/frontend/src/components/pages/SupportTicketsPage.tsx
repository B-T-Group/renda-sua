import { ArrowBack as ArrowBackIcon, Support as SupportIcon } from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Grid,
    IconButton,
    Paper,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

export interface SupportTicketRow {
  id: string;
  order_id: string;
  user_id: string;
  type: string;
  status: string;
  subject: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  order?: { order_number: string };
}

const SupportTicketsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const api = useApiClient();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      const { data } = await api.get<SupportTicketRow[]>('/support/tickets');
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const getStatusColor = (status: string): 'default' | 'warning' | 'success' | 'info' => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'in_review':
        return 'info';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'dispute':
        return t('support.types.dispute', 'Dispute');
      case 'complaint':
        return t('support.types.complaint', 'Complaint');
      case 'question':
        return t('support.types.question', 'Question');
      default:
        return type;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          aria-label={t('common.back', 'Back')}
          onClick={() => navigate(-1)}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <SupportIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight="bold">
          {t('support.myTickets', 'My support tickets')}
        </Typography>
      </Box>

      <Grid container sx={{ width: '100%' }}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              {loading ? (
                <Box sx={{ py: 2 }}>
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                </Box>
              ) : tickets.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  {t('support.noTickets', 'You have no support tickets yet.')}
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('support.order', 'Order')}</TableCell>
                        <TableCell>{t('support.type', 'Type')}</TableCell>
                        <TableCell>{t('support.subject', 'Subject')}</TableCell>
                        <TableCell>{t('support.status', 'Status')}</TableCell>
                        <TableCell>{t('support.created', 'Created')}</TableCell>
                        <TableCell align="right">{t('support.actions', 'Actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tickets.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            {row.order?.order_number ?? row.order_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{getTypeLabel(row.type)}</TableCell>
                          <TableCell>{row.subject}</TableCell>
                          <TableCell>
                            <Chip
                              label={t(`support.status.${row.status}`, row.status)}
                              color={getStatusColor(row.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{formatDate(row.created_at)}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              onClick={() => navigate(`/orders/${row.order_id}`)}
                            >
                              {t('support.viewOrder', 'View order')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SupportTicketsPage;
