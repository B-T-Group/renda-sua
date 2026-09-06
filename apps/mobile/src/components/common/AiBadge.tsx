import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from './StatusPill';
import { useTheme } from '../../contexts/ThemeContext';

export function AiBadge({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <StatusPill
      icon="auto-fix"
      compact
      label={label ?? t('ftue.hero.aiTokens', '20 free AI tokens')}
      backgroundColor={colors.info.main + '22'}
      textColor={colors.info.dark}
    />
  );
}
