import { Box, Typography } from '@mui/material';
import {
  storeAvatarPalette,
  storeMonogram,
} from '../../utils/storeAvatarPalette';

type Props = {
  name: string;
  size?: number;
};

/** Illustrated default store mark when no logo is uploaded. */
export function StoreDefaultAvatar({ name, size = 64 }: Props) {
  const palette = storeAvatarPalette(name);
  const letter = storeMonogram(name);
  const radius = Math.round(size * 0.22);
  const fontSize = size >= 64 ? Math.round(size * 0.28) : Math.round(size * 0.34);

  return (
    <Box
      role="img"
      aria-label={`${name} store avatar`}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: `${radius}px`,
        overflow: 'hidden',
        bgcolor: palette.bgSoft,
        flexShrink: 0,
      }}
    >
      <Box
        component="svg"
        width={size}
        height={size}
        viewBox="0 0 80 80"
        sx={{ display: 'block' }}
      >
        <circle cx="40" cy="40" r="36" fill={palette.bg} opacity={0.12} />
        <rect
          x="18"
          y="34"
          width="44"
          height="28"
          rx="4"
          fill={palette.bg}
          opacity={0.92}
        />
        <path d="M18 38 L40 22 L62 38" fill={palette.accent} />
        <rect
          x="34"
          y="44"
          width="12"
          height="18"
          rx="2"
          fill={palette.accentSoft}
        />
        <circle cx="28" cy="48" r="3" fill={palette.accentSoft} />
        <circle cx="52" cy="48" r="3" fill={palette.accentSoft} />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: size * 0.06,
          right: size * 0.06,
          minWidth: size * 0.42,
          height: size * 0.42,
          borderRadius: '50%',
          bgcolor: palette.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 0.5,
        }}
      >
        <Typography
          component="span"
          sx={{
            color: palette.monogram,
            fontWeight: 800,
            fontSize,
            lineHeight: 1,
          }}
        >
          {letter}
        </Typography>
      </Box>
    </Box>
  );
}
