import { Box } from '@mui/material';
import React from 'react';

const SLOT_COUNT = 4;

export interface CollectionPreviewMosaicProps {
  imageUrls: string[];
  gap?: number;
  tileBorderRadius?: number;
}

function MosaicTile({
  uri,
  tileBorderRadius,
}: {
  uri: string | null;
  tileBorderRadius: number;
}) {
  return (
    <Box
      sx={{
        aspectRatio: '1 / 1',
        borderRadius: tileBorderRadius,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {uri ? (
        <Box
          component="img"
          src={uri}
          alt=""
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : null}
    </Box>
  );
}

export function CollectionPreviewMosaic({
  imageUrls,
  gap = 12,
  tileBorderRadius = 12,
}: CollectionPreviewMosaicProps) {
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) =>
    imageUrls[index]?.trim() || null
  );

  const row = (left: number, right: number) => (
    <Box sx={{ display: 'flex', gap, width: '100%' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MosaicTile uri={slots[left]} tileBorderRadius={tileBorderRadius} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MosaicTile uri={slots[right]} tileBorderRadius={tileBorderRadius} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap, width: '100%' }}>
      {row(0, 1)}
      {row(2, 3)}
    </Box>
  );
}
