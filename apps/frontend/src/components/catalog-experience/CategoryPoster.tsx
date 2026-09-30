import { Box, Card, CardActionArea, Typography } from '@mui/material';
import React from 'react';

export function CategoryPoster({
  name,
  imageUrl,
  countLabel,
  ariaLabel,
  onSelect,
}: {
  name: string;
  imageUrl: string | null;
  countLabel?: string;
  ariaLabel: string;
  onSelect: () => void;
}) {
  return (
    <Card sx={{ width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden' }}>
      <CardActionArea onClick={onSelect} aria-label={ariaLabel} sx={{ height: '100%', position: 'relative' }}>
        <CategoryArt name={name} imageUrl={imageUrl} />
        <CategoryCaption name={name} countLabel={countLabel} />
      </CardActionArea>
    </Card>
  );
}

function CategoryCaption({ name, countLabel }: { name: string; countLabel?: string }) {
  return (
    <Box sx={captionSx}>
      <Typography color="common.white" fontWeight={700} sx={nameTextSx}>
        {name}
      </Typography>
      {countLabel ? (
        <Typography variant="caption" sx={countSx}>
          {countLabel}
        </Typography>
      ) : null}
    </Box>
  );
}

function CategoryArt({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return <Box component="img" src={imageUrl} alt="" sx={imageSx} />;
  }
  return (
    <Box sx={fallbackArtSx}>
      <Typography variant="h3" color="text.secondary">
        {name.trim().slice(0, 1).toUpperCase()}
      </Typography>
    </Box>
  );
}

const captionSx = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  px: 1.25,
  pt: 3,
  pb: 1.25,
  background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 58%, transparent 100%)',
};

const nameTextSx = {
  width: '100%',
  lineHeight: 1.25,
  textAlign: 'center',
  overflow: 'hidden',
  maxHeight: '2.5em',
};

const countSx = {
  display: 'block',
  textAlign: 'center',
  color: 'rgba(255,255,255,0.88)',
  mt: 0.25,
};

const imageSx = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const fallbackArtSx = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: 'action.hover',
};
