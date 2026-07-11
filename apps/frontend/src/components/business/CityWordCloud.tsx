import { Box, Typography, useTheme } from '@mui/material';
import React, { useMemo } from 'react';

export interface CityWordCloudItem {
  name: string;
  count: number;
}

export interface CityWordCloudProps {
  cities: CityWordCloudItem[];
  emptyLabel: string;
}

function fontSizeFor(count: number, min: number, max: number): number {
  if (max <= min) return 22;
  const t = (count - min) / (max - min);
  return 14 + t * 28;
}

function opacityFor(count: number, min: number, max: number): number {
  if (max <= min) return 1;
  const t = (count - min) / (max - min);
  return 0.55 + t * 0.45;
}

/**
 * Lightweight word cloud for client origin cities (no chart library).
 */
export function CityWordCloud({ cities, emptyLabel }: CityWordCloudProps) {
  const theme = useTheme();
  const layout = useMemo(() => {
    if (!cities.length) return [];
    const counts = cities.map((c) => c.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const palette = [
      theme.palette.primary.main,
      theme.palette.primary.dark,
      theme.palette.secondary.main,
      theme.palette.info.main,
      theme.palette.success.main,
    ];
    return cities.map((city, index) => ({
      ...city,
      fontSize: fontSizeFor(city.count, min, max),
      opacity: opacityFor(city.count, min, max),
      color: palette[index % palette.length],
      rotate: index % 5 === 0 ? -8 : index % 7 === 0 ? 8 : 0,
    }));
  }, [cities, theme]);

  if (!layout.length) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1.5, md: 2 },
        minHeight: 280,
        p: { xs: 2, md: 4 },
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        backgroundImage: (t) =>
          `radial-gradient(circle at 20% 20%, ${t.palette.primary.main}10 0%, transparent 45%), radial-gradient(circle at 80% 70%, ${t.palette.secondary.main}0c 0%, transparent 40%)`,
      }}
    >
      {layout.map((city) => (
        <Typography
          key={city.name}
          component="span"
          title={`${city.name}: ${city.count}`}
          sx={{
            fontWeight: city.count === Math.max(...cities.map((c) => c.count)) ? 800 : 600,
            fontSize: city.fontSize,
            lineHeight: 1.15,
            color: city.color,
            opacity: city.opacity,
            transform: `rotate(${city.rotate}deg)`,
            px: 0.5,
            userSelect: 'none',
            letterSpacing: city.fontSize > 28 ? 0.4 : 0,
          }}
        >
          {city.name}
        </Typography>
      ))}
    </Box>
  );
}

export default CityWordCloud;
