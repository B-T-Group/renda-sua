import { Star } from '@mui/icons-material';
import { Avatar, Box, Card, CardContent, Grid, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

/** TODO_REPLACE_TESTIMONIAL_1..3 with real merchant quotes and photos. */
const Testimonials: React.FC = () => {
  const { t } = useTranslation();
  const items = [1, 2, 3];

  return (
    <SectionShell
      title={t('forBusiness.testimonials.title', 'Merchants like you')}
      subtitle={t(
        'forBusiness.testimonials.subtitle',
        'What sellers say after switching to Rendasua.'
      )}
      bgcolor="background.paper"
    >
      <Grid container spacing={2.5}>
        {items.map((n) => (
          <Grid key={n} size={{ xs: 12, md: 4 }}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                border: '1.5px solid',
                borderColor: 'divider',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, color: '#f59e0b' }} aria-label="5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} sx={{ fontSize: 18 }} />
                  ))}
                </Box>
                <Typography variant="body1" sx={{ mb: 2.5, lineHeight: 1.7, fontStyle: 'italic' }}>
                  “
                  {t(
                    `forBusiness.testimonials.item${n}.quote`,
                    'Rendasua helped me reach customers I never had on WhatsApp alone.'
                  )}
                  ”
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {/* TODO_REPLACE_TESTIMONIAL photo */}
                  <Avatar sx={{ bgcolor: alpha(FB_ACCENT, 0.2), color: FB_ACCENT }}>
                    {t(`forBusiness.testimonials.item${n}.name`, 'Amina K.').charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {t(`forBusiness.testimonials.item${n}.name`, 'Amina K.')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t(
                        `forBusiness.testimonials.item${n}.business`,
                        'Local Boutique'
                      )}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </SectionShell>
  );
};

export default Testimonials;
