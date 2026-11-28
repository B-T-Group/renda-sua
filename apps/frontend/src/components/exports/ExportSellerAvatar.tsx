import { Box } from '@mui/material';
import React, { useState } from 'react';
import { exportSellerMonogram, exportSellerTint } from '../../utils/exportSellers';

/** Location logo on a white rounded plate, or a non-purple monogram when missing or broken. */
export const ExportSellerAvatar: React.FC<{ name: string; logoUrl?: string | null; size?: number }> = ({
  name,
  logoUrl,
  size = 56,
}) => {
  const [failed, setFailed] = useState(false);
  const radius = `${Math.round(size * 0.22)}px`;
  if (logoUrl && !failed) {
    return (
      <Box
        data-testid="export-seller-logo"
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: radius,
          bgcolor: '#fff',
          border: '1px solid #D8DEE8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={logoUrl}
          alt=""
          onError={() => setFailed(true)}
          sx={{ width: size - 8, height: size - 8, objectFit: 'contain' }}
        />
      </Box>
    );
  }
  return (
    <Box
      data-testid="export-seller-monogram"
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        bgcolor: exportSellerTint(name),
        color: '#fff',
        fontWeight: 800,
        fontSize: Math.round(size * 0.36),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {exportSellerMonogram(name)}
    </Box>
  );
};

/** ISO chip + city (+ optional trailing country name). */
export const ExportSellerPlace: React.FC<{ country?: string | null; city?: string | null; trailing?: string | null }> = ({
  country,
  city,
  trailing,
}) => {
  const text = [city, trailing].filter(Boolean).join(', ');
  if (!country && !text) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      {country ? (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 800,
            px: 0.5,
            borderRadius: 0.5,
            border: '1px solid #C8D1DD',
            color: 'text.secondary',
            lineHeight: 1.5,
          }}
        >
          {country}
        </Box>
      ) : null}
      {text ? (
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </Box>
      ) : null}
    </Box>
  );
};

export default ExportSellerAvatar;
