import { useTheme } from '@mui/material/styles';
import React from 'react';

interface ExportOrderIllustrationProps {
  label: string;
  size?: number;
}

export const ExportOrderIllustration: React.FC<ExportOrderIllustrationProps> = ({
  label,
  size = 96,
}) => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const success = theme.palette.success.main;
  const paper = theme.palette.background.paper;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
    >
      <circle cx="48" cy="48" r="46" fill={primary} opacity="0.08" />
      <rect x="24" y="14" width="40" height="54" rx="6" fill={paper} stroke={primary} strokeWidth="3" />
      <rect x="31" y="26" width="26" height="4" rx="2" fill={primary} opacity="0.5" />
      <rect x="31" y="36" width="20" height="4" rx="2" fill={primary} opacity="0.3" />
      <rect x="31" y="46" width="23" height="4" rx="2" fill={primary} opacity="0.3" />
      <circle cx="64" cy="66" r="15" fill={success} />
      <path d="M57 66l5 5 9-10" stroke={paper} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
