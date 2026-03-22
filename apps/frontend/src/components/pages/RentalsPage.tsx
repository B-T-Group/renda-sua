import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Container,
  Grid,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRentalListings } from '../../hooks/useRentalListings';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const RentalsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { listings, loading, error } = useRentalListings();

  if (loading) {
    return (
      <LoadingPage
        message={t('rentals.loading', 'Loading rentals')}
        subtitle={t('rentals.loadingSubtitle', 'Please wait')}
        showProgress
      />
    );
  }

  return (
    <>
      <SEOHead
        title={t('rentals.title', 'Available rentals')}
        description={t(
          'rentals.metaDescription',
          'Browse business-operated rentals on Rendasua'
        )}
      />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('rentals.title', 'Available rentals')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t(
            'rentals.businessOperatedNotice',
            'All rentals are operated by the business (you do not take equipment home unattended).'
          )}
        </Typography>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <Grid container spacing={2}>
          {listings.map((row) => {
            const img = row.rental_item.rental_item_images[0]?.image_url;
            return (
              <Grid item xs={12} sm={6} md={4} key={row.id}>
                <Card elevation={2}>
                  <CardActionArea onClick={() => navigate(`/rentals/${row.id}`)}>
                    {img ? (
                      <CardMedia
                        component="img"
                        height="160"
                        image={img}
                        alt={row.rental_item.name}
                        sx={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: 160,
                          bgcolor: 'grey.200',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {t('rentals.noImage', 'No image')}
                        </Typography>
                      </Box>
                    )}
                    <CardContent>
                      <Typography variant="h6" component="div" noWrap>
                        {row.rental_item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {row.rental_item.business.name} ·{' '}
                        {row.business_location.name}
                      </Typography>
                      <Typography variant="subtitle1" sx={{ mt: 1 }}>
                        {row.base_price_per_day} {row.rental_item.currency}{' '}
                        {t('rentals.perDay', '/ day')}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        {!loading && listings.length === 0 && !error && (
          <Typography sx={{ mt: 2 }}>
            {t('rentals.empty', 'No rentals available yet.')}
          </Typography>
        )}
      </Container>
    </>
  );
};

export default RentalsPage;
