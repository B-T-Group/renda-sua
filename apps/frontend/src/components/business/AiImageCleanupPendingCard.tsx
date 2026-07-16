import { AutoAwesome as AutoAwesomeIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface AiImageCleanupPendingCardProps {
  pendingCount: number;
  itemName?: string;
  onClick: () => void;
}

const AiImageCleanupPendingCard: React.FC<AiImageCleanupPendingCardProps> = ({
  pendingCount,
  itemName,
  onClick,
}) => {
  const { t } = useTranslation();
  if (pendingCount <= 0) return null;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 3,
        borderColor: 'primary.main',
        borderWidth: 1.5,
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'primary.50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AutoAwesomeIcon color="primary" fontSize="small" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t(
                'business.images.asyncCleanup.dashboardTitle',
                '{{count}} AI-cleaned photos ready to review',
                { count: pendingCount }
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {itemName
                ? t(
                    'business.images.asyncCleanup.dashboardSubtitleNamed',
                    'Review before & after for “{{name}}”.',
                    { name: itemName }
                  )
                : t(
                    'business.images.asyncCleanup.dashboardSubtitle',
                    'Tap to accept, reject, or retry cleaned images.'
                  )}
            </Typography>
          </Box>
          <ChevronRightIcon color="action" />
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default AiImageCleanupPendingCard;
