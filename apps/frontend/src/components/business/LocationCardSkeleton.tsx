import {
  Box,
  Card,
  CardActions,
  CardContent,
  Skeleton,
  Stack,
} from '@mui/material';
import React from 'react';

const LocationCardSkeleton: React.FC = () => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
        >
          <Skeleton variant="text" width="70%" height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </Box>

        {/* Address */}
        <Box mb={2}>
          <Stack direction="row" spacing={0.5} alignItems="flex-start" mb={1}>
            <Skeleton
              variant="circular"
              width={18}
              height={18}
              sx={{ mt: 0.3 }}
            />
            <Skeleton variant="text" width="100%" height={20} />
          </Stack>

          {/* Contact Info */}
          <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
            <Skeleton variant="circular" width={16} height={16} />
            <Skeleton variant="text" width="60%" height={20} />
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center">
            <Skeleton variant="circular" width={16} height={16} />
            <Skeleton variant="text" width="80%" height={20} />
          </Stack>
        </Box>

        {/* Badges */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
          <Skeleton variant="rounded" width={70} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="rounded" width={60} height={24} />
        </Stack>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Skeleton variant="rounded" width={70} height={32} />
        <Skeleton variant="rounded" width={90} height={32} />
      </CardActions>
    </Card>
  );
};

export default LocationCardSkeleton;
