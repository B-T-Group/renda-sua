import { ArrowBack as ArrowBackIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useRentalApi, type BusinessRentalItemDetail } from '../../hooks/useRentalApi';
import { renderRichTextToHtml } from '../../utils/richText';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const BusinessRentalItemViewPage: React.FC = () => {
  const { t } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { fetchBusinessRentalItem } = useRentalApi();
  const [item, setItem] = useState<BusinessRentalItemDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!itemId) return;
    const next = await fetchBusinessRentalItem(itemId);
    setItem(next);
  }, [fetchBusinessRentalItem, itemId]);

  useEffect(() => {
    if (!businessId || !itemId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [businessId, itemId, load]);

  const coverImage = item?.rental_item_images?.[0]?.image_url ?? '';
  const renderedDescription = useMemo(
    () => renderRichTextToHtml(item?.description ?? ''),
    [item?.description]
  );

  if (!businessId) {
    return (
      <Typography sx={{ p: 3 }}>
        {t('business.dashboard.noBusinessProfile')}
      </Typography>
    );
  }

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  if (!item) {
    return (
      <Box sx={{ p: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/business/rentals/catalog')}
          sx={{ mb: 2 }}
        >
          {t('business.rentals.backToCatalog', 'Back to rentals')}
        </Button>
        <Typography>{t('business.rentals.loadError', 'Could not load this rental.')}</Typography>
      </Box>
    );
  }

  return (
    <>
      <SEOHead title={t('business.rentals.previewItemTitle', 'Preview rental')} />
      <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/business/rentals/catalog')}
          >
            {t('business.rentals.backToCatalog', 'Back to rentals')}
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/business/rentals/items/${item.id}/edit`)}
          >
            {t('business.rentals.edit', 'Edit')}
          </Button>
        </Stack>

        <Paper sx={{ overflow: 'hidden', borderRadius: 2 }}>
          {coverImage ? (
            <Box
              component="img"
              src={coverImage}
              alt={item.name}
              sx={{ width: '100%', height: { xs: 220, md: 320 }, objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: { xs: 220, md: 320 },
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography color="text.secondary">
                {t('rentals.noImage', 'No image')}
              </Typography>
            </Box>
          )}
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {item.name}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.25, mb: 2 }} flexWrap="wrap">
              <Chip
                size="small"
                label={t('business.rentals.imageCount', 'Images: {{count}}', {
                  count: item.rental_item_images.length,
                })}
              />
              <Chip
                size="small"
                label={item.is_active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                color={item.is_active ? 'success' : 'default'}
              />
            </Stack>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              {t('common.description', 'Description')}
            </Typography>
            <Box
              sx={{
                '& code': { bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 },
                '& blockquote': {
                  borderLeft: '3px solid',
                  borderColor: 'divider',
                  pl: 1.5,
                  m: 0,
                  color: 'text.secondary',
                },
              }}
              dangerouslySetInnerHTML={{ __html: renderedDescription }}
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              {t('business.rentals.listingsSection', 'Location listings')}
            </Typography>
            <Stack spacing={1.5}>
              {item.rental_location_listings.map((listing) => (
                <Paper key={listing.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {listing.business_location?.name ??
                      t('business.rentals.location', 'Location')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.rentals.pricePerHour', 'Price per hour')}: {listing.base_price_per_hour}{' '}
                    {item.currency}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('business.rentals.pricePerDay', 'Full day price (daily rate)')}:{' '}
                    {listing.base_price_per_day} {item.currency}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Box>
    </>
  );
};

export default BusinessRentalItemViewPage;
