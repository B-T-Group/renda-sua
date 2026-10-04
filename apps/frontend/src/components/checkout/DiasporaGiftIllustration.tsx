import { Box, useTheme } from '@mui/material';
import React from 'react';
import { brandTokens } from '../../theme/brandTokens';

type Props = {
  size?: number;
  label: string;
};

/** A gift crossed with a gold star — sending care to someone. */
export function DiasporaGiftIllustration({ size = 88, label }: Props) {
  const theme = useTheme();
  const gold = theme.palette.warning.main;
  const goldLight = theme.palette.warning.light;
  const cream = brandTokens.warning.soft;
  const blue = theme.palette.primary.main;
  const paper = theme.palette.background.paper;

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={label}
      sx={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="48" cy="48" r="44" fill={cream} />
      <Star cx={70} cy={22} fill={gold} />
      <Star cx={22} cy={28} fill={goldLight} scale={0.55} />
      <rect x="30" y="40" width="36" height="28" rx="4" fill={blue} />
      <rect x="30" y="34" width="36" height="10" rx="3" fill={gold} />
      <rect x="44" y="34" width="8" height="34" fill={paper} />
      <rect x="30" y="44" width="36" height="6" fill={paper} opacity={0.85} />
    </Box>
  );
}

function Star({
  cx,
  cy,
  fill,
  scale = 1,
}: {
  cx: number;
  cy: number;
  fill: string;
  scale?: number;
}) {
  const d =
    'M12 2.2 14.7 8.6 21.6 9.2 16.4 13.6 18 20.3 12 16.8 6 20.3 7.6 13.6 2.4 9.2 9.3 8.6 Z';
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(-12 -12)`}>
      <path d={d} fill={fill} />
    </g>
  );
}
