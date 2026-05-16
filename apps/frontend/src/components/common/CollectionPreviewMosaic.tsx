import { Box } from '@mui/material';
import React from 'react';

const SLOT_COUNT = 4;

export interface CollectionPreviewMosaicProps {
  imageUrls: string[];
}

export function CollectionPreviewMosaic({ imageUrls }: CollectionPreviewMosaicProps) {
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) =>
    imageUrls[index]?.trim() || null
  );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '1px',
        bgcolor: 'divider',
      }}
    >
      {slots.map((uri, index) => (
        <Box
          key={index}
          sx={{
            overflow: 'hidden',
            bgcolor: 'action.hover',
            minHeight: 0,
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
      ))}
    </Box>
  );
}
