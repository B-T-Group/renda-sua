import {
  ChevronRight as ChevronRightIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface LocationTransferPendingCardProps {
  pendingCount: number;
  fromBusinessName?: string;
  onClick: () => void;
}

const LocationTransferPendingCard: React.FC<LocationTransferPendingCardProps> = ({
  pendingCount,
  fromBusinessName,
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
            <SwapHorizIcon color="primary" fontSize="small" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t(
                'business.locations.transfer.dashboardTitle',
                '{{count}} location transfer awaiting your decision',
                { count: pendingCount }
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pendingCount === 1 && fromBusinessName
                ? t(
                    'business.locations.transfer.dashboardSubtitleNamed',
                    'From {{name}} — click to accept or reject.',
                    { name: fromBusinessName }
                  )
                : t(
                    'business.locations.transfer.dashboardSubtitle',
                    'Click to review, accept, or reject the requests.'
                  )}
            </Typography>
          </Box>
          <ChevronRightIcon color="action" />
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default LocationTransferPendingCard;
