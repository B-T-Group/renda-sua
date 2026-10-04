import { Box, Skeleton } from '@mui/material';

export function ProductCardSkeleton() {
  return (
    <Box sx={{ width: 180 }}>
      <Skeleton variant="rounded" height={180} />
      <Skeleton width="80%" sx={{ mt: 1 }} />
      <Skeleton width="40%" />
    </Box>
  );
}

export function RailSkeleton() {
  return (
    <Box sx={{ mb: 4 }}>
      <Skeleton width={160} height={28} />
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, overflow: 'hidden' }}>
        <ProductCardSkeleton />
        <ProductCardSkeleton />
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </Box>
    </Box>
  );
}

export function ListRowSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.5 }}>
      <Skeleton variant="rounded" width={48} height={48} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="60%" />
        <Skeleton width="30%" />
      </Box>
    </Box>
  );
}

export function DetailSkeleton() {
  return (
    <Box>
      <Skeleton variant="rectangular" height={420} />
      <Box sx={{ p: 2 }}>
        <Skeleton width="70%" height={32} />
        <Skeleton width="30%" height={40} sx={{ mt: 1 }} />
        <Skeleton width="50%" sx={{ mt: 1 }} />
      </Box>
    </Box>
  );
}
