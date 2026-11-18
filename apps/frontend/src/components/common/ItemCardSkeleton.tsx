import { Box, Card, CardContent, Skeleton } from '@mui/material';
import React from 'react';

/** Catalog grid placeholder matching DashboardItemCard proportions. */
const ItemCardSkeleton: React.FC = () => (
  <Card
    elevation={0}
    sx={{
      height: '100%',
      border: 1,
      borderColor: 'divider',
      borderRadius: 2,
      overflow: 'hidden',
    }}
  >
    <Skeleton variant="rectangular" height={240} animation="wave" />
    <CardContent sx={{ p: 2 }}>
      <Skeleton
        variant="text"
        width="80%"
        height={24}
        sx={{ mb: 1 }}
        animation="wave"
      />
      <Skeleton
        variant="text"
        width="60%"
        height={20}
        sx={{ mb: 1 }}
        animation="wave"
      />
      <Skeleton
        variant="text"
        width="40%"
        height={16}
        sx={{ mb: 2 }}
        animation="wave"
      />
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Skeleton variant="rounded" width={60} height={24} animation="wave" />
        <Skeleton variant="rounded" width={80} height={24} animation="wave" />
      </Box>
      <Skeleton variant="rounded" width="100%" height={36} animation="wave" />
    </CardContent>
  </Card>
);

export default ItemCardSkeleton;
