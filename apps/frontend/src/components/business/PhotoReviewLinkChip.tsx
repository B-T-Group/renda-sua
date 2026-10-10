import { Chip } from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

export function PhotoReviewLinkChip({
  jobId,
  label,
}: {
  jobId: string;
  label: string;
}) {
  return (
    <Chip
      component={RouterLink}
      to={`/business/items/ai-image-cleanup/${jobId}`}
      clickable
      size="small"
      color="info"
      variant="outlined"
      label={label}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
