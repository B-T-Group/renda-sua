import {
  Alert,
  Box,
  Button,
  Container,
  Skeleton,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { CityWordCloud } from '../business/CityWordCloud';
import SEOHead from '../seo/SEOHead';

interface ClientCitiesResponse {
  success: boolean;
  data: {
    cities: { name: string; count: number }[];
    totalClientsWithCity: number;
  };
}

const BusinessClientCitiesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const apiClient = useApiClient();
  const [cities, setCities] = useState<{ name: string; count: number }[]>([]);
  const [totalWithCity, setTotalWithCity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiClient || !profile?.business?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ClientCitiesResponse>('/dashboard/client-cities');
      if (res.data.success && res.data.data) {
        setCities(res.data.data.cities ?? []);
        setTotalWithCity(res.data.data.totalClientsWithCity ?? 0);
      } else {
        setCities([]);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          err?.message ??
          t('business.clientCities.loadError', 'Failed to load client cities')
      );
    } finally {
      setLoading(false);
    }
  }, [apiClient, profile?.business?.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile?.business) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile', 'No business profile found')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <SEOHead
        title={t('business.clientCities.seoTitle', 'Where your clients are from')}
        description={t(
          'business.clientCities.seoDescription',
          'See which cities your customers come from.'
        )}
      />
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2 }}
      >
        {t('business.dashboard.backToDashboard', 'Back to dashboard')}
      </Button>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        {t('business.clientCities.title', 'Where your clients are from')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'business.clientCities.subtitle',
          'A word cloud of cities for people who have ordered or rented from you.'
        )}
      </Typography>
      {loading ? (
        <Skeleton variant="rounded" height={280} />
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void load()}>
              {t('common.retry', 'Retry')}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <>
          {totalWithCity > 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('business.clientCities.stat', {
                count: totalWithCity,
                defaultValue: '{{count}} clients with a known city',
              })}
            </Typography>
          ) : null}
          <CityWordCloud
            cities={cities}
            emptyLabel={t(
              'business.clientCities.empty',
              'No client cities yet. Cities appear as customers order or rent with an address.'
            )}
          />
          {cities.length > 0 ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {t('business.clientCities.legend', 'Cities by client count')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {cities.slice(0, 12).map((city) => (
                  <Typography
                    key={city.name}
                    variant="caption"
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: 'action.hover',
                      color: 'text.secondary',
                    }}
                  >
                    {city.name} · {city.count}
                  </Typography>
                ))}
              </Box>
            </Box>
          ) : null}
        </>
      )}
    </Container>
  );
};

export default BusinessClientCitiesPage;
