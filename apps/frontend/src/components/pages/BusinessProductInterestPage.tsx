import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Link,
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

function clientContact(row: ProductInterestRow): string {
  const u = row.client_user;
  if (!u) return '—';
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return [name || null, u.phone_number, u.email].filter(Boolean).join(' · ');
}

const BusinessProductInterestPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { listBusiness } = useProductInterest();
  const [rows, setRows] = useState<ProductInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBusiness(1, 50);
      setRows(data?.items ?? []);
    } catch {
      setError(
        t('productInterest.loadError', 'Could not load interest leads')
      );
    } finally {
      setLoading(false);
    }
  }, [listBusiness, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingPage />;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <SEOHead
        title={t('productInterest.businessTitle', 'Product interest')}
      />
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/business')}
        sx={{ mb: 2 }}
      >
        {t('common.back', 'Back')}
      </Button>
      <Typography variant="h4" gutterBottom>
        {t('productInterest.businessTitle', 'Product interest')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'productInterest.businessHelp',
          'Clients asked to be contacted about these items. Follow up by phone or email outside the app.'
        )}
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {!error && rows.length === 0 && (
        <Typography color="text.secondary">
          {t('productInterest.emptyBusiness', 'No interest leads yet.')}
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
                {row.business_location?.name || '—'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('productInterest.clientLabel', 'Client')}: {clientContact(row)}
              </Typography>
              {row.client_note && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {t('productInterest.noteLabel', 'Message (optional)')}:{' '}
                  {row.client_note}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {new Date(row.created_at).toLocaleString()}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Link
                  component="button"
                  type="button"
                  onClick={() =>
                    navigate(`/items/${row.business_inventory_id}`)
                  }
                >
                  {t('productInterest.viewItem', 'View item')}
                </Link>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
};

export default BusinessProductInterestPage;
