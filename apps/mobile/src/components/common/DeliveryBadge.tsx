import React from 'react';
import { StatusPill } from './StatusPill';
import { useTheme } from '../../contexts/ThemeContext';

export function DeliveryBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <StatusPill
      icon="truck-delivery-outline"
      compact
      label={label}
      backgroundColor={colors.warning.main + '22'}
      textColor={colors.warning.dark}
    />
  );
}
