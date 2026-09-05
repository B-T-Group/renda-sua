import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useProductInterest,
  type ProductInterestRow,
} from '../../hooks/useProductInterest';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const ClientProductInterestPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { listClient } = useProductInterest();
  const [rows, setRows] = useState<ProductInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClient(1, 50);
      setRows(data?.items ?? []);
    } catch {
      setError(
        t('productInterest.loadError', 'Could not load interest submissions')
      );
    } finally {
      setLoading(false);
    }
  }, [listClient, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingPage />;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <SEOHead
        title={t('productInterest.clientTitle', 'My interest requests')}
      />
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        {t('common.back', 'Back')}
      </Button>
      <Typography variant="h4" gutterBottom>
        {t('productInterest.clientTitle', 'My interest requests')}
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {!error && rows.length === 0 && (
        <Typography color="text.secondary">
          {t('productInterest.emptyClient', 'No interest submissions yet.')}
        </Typography>
      )}
      <Stack spacing={2}>
        {rows.map((row) => (
          <Card key={row.id} variant="outlined">
            <CardContent>
              <Typography variant="h6">
                {row.item?.name ?? t('productInterest.unknownItem', 'Item')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.business_location?.name || row.business?.name || '—'}
              </Typography>
              {row.client_note && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {row.client_note}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {new Date(row.created_at).toLocaleString()} · {row.status}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  onClick={() =>
                    navigate(`/items/${row.business_inventory_id}`)
                  }
                >
                  {t('productInterest.viewItem', 'View item')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
};

export default ClientProductInterestPage;
