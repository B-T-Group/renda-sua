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
        width: '100%',
        borderRadius: `${tileBorderRadius}px`,
        border: '1px solid',
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
  gap = 6,
  tileBorderRadius = 10,
}: CollectionPreviewMosaicProps) {
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) =>
    imageUrls[index]?.trim() || null
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: `${gap}px`,
        width: '100%',
      }}
    >
      {slots.map((uri, index) => (
        <MosaicTile key={index} uri={uri} tileBorderRadius={tileBorderRadius} />
      ))}
    </Box>
  );
}
