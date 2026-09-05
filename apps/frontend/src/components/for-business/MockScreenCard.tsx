import { Box, Typography, alpha } from '@mui/material';
import React from 'react';
import { FB_ACCENT } from './forBusinessTheme';

export type MockScreenKind =
  | 'dashboard'
  | 'inventory'
  | 'orders'
  | 'analytics'
  | 'ai';

interface MockScreenCardProps {
  kind: MockScreenKind;
  title: string;
  caption?: string;
  /** Optional real screenshot later — TODO_REPLACE_SCREENSHOT_* */
  imageSrc?: string;
}

function MockChrome({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1.5px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 0.75,
          px: 1.5,
          py: 1,
          bgcolor: alpha('#0f172a', 0.04),
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
        aria-hidden
      >
        {['#f87171', '#fbbf24', '#4ade80'].map((c) => (
          <Box key={c} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
        ))}
      </Box>
      <Box sx={{ p: 1.5, flex: 1, minHeight: 160 }}>{children}</Box>
    </Box>
  );
}

function bars(n: number, color: string) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, height: 72, mt: 1 }} aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <Box
          key={i}
          sx={{
            flex: 1,
            height: `${35 + ((i * 17) % 55)}%`,
            borderRadius: 1,
            bgcolor: alpha(color, 0.35 + (i % 3) * 0.15),
          }}
        />
      ))}
    </Box>
  );
}

function MockBody({ kind }: { kind: MockScreenKind }) {
  if (kind === 'dashboard') {
    return (
      <>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }} aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(FB_ACCENT, 0.08) }}>
              <Box sx={{ height: 8, width: '40%', bgcolor: alpha(FB_ACCENT, 0.35), borderRadius: 1, mb: 1 }} />
              <Box sx={{ height: 14, width: '70%', bgcolor: alpha('#0f172a', 0.12), borderRadius: 1 }} />
            </Box>
          ))}
        </Box>
        {bars(6, FB_ACCENT)}
      </>
    );
  }
  if (kind === 'inventory') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: alpha('#64748b', 0.15) }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ height: 8, width: '55%', bgcolor: alpha('#0f172a', 0.14), borderRadius: 1, mb: 0.5 }} />
              <Box sx={{ height: 6, width: '30%', bgcolor: alpha(FB_ACCENT, 0.35), borderRadius: 1 }} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }
  if (kind === 'orders') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-hidden>
        {[FB_ACCENT, '#f59e0b', '#3b82f6'].map((c, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 1,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ height: 8, width: '45%', bgcolor: alpha('#0f172a', 0.12), borderRadius: 1 }} />
            <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha(c, 0.15), height: 16, width: 48 }} />
          </Box>
        ))}
      </Box>
    );
  }
  if (kind === 'analytics') {
    return bars(8, '#1d4ed8');
  }
  return (
    <Box aria-hidden>
      <Box sx={{ height: 64, borderRadius: 1.5, bgcolor: alpha('#0f172a', 0.06), mb: 1 }} />
      <Box sx={{ height: 8, width: '90%', bgcolor: alpha('#0f172a', 0.1), borderRadius: 1, mb: 0.5 }} />
      <Box sx={{ height: 8, width: '75%', bgcolor: alpha('#0f172a', 0.08), borderRadius: 1, mb: 0.5 }} />
      <Box sx={{ height: 8, width: '60%', bgcolor: alpha(FB_ACCENT, 0.25), borderRadius: 1 }} />
    </Box>
  );
}

const MockScreenCard: React.FC<MockScreenCardProps> = ({ kind, title, caption, imageSrc }) => (
  <Box sx={{ width: { xs: 260, sm: 280 }, flexShrink: 0 }}>
    <MockChrome>
      {imageSrc ? (
        <Box
          component="img"
          src={imageSrc}
          alt={title}
          loading="lazy"
          sx={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 1 }}
        />
      ) : (
        <MockBody kind={kind} />
      )}
    </MockChrome>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1.5, textAlign: 'center' }}>
      {title}
    </Typography>
    {caption ? (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>
        {caption}
      </Typography>
    ) : null}
  </Box>
);

export default MockScreenCard;
