import React from 'react';
import { StatusPill } from './StatusPill';
import { useTheme } from '../../contexts/ThemeContext';

export function PaymentBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <StatusPill
      icon="cellphone"
      compact
      label={label}
      backgroundColor={colors.success.main + '22'}
      textColor={colors.success.dark}
    />
  );
}
