import React from 'react';
import { useTranslation } from 'react-i18next';
import { NoticeBanner } from './NoticeBanner';

type Props = {
  onPress: () => void;
  style?: React.ComponentProps<typeof NoticeBanner>['style'];
};

/**
 * Dashboard entry to the AI assistant — high visibility, secondary to primary work.
 */
export function AssistantHomeEntry({ onPress, style }: Props) {
  const { t } = useTranslation();
  return (
    <NoticeBanner
      tone="info"
      icon="creation"
      title={t('assistant.homeEntryTitle', 'Ask the AI assistant')}
      message={t(
        'assistant.homeEntryBody',
        'Get quick answers about delivery, payments, pickup, and your account.'
      )}
      actionLabel={t('assistant.homeEntryCta', 'Open assistant')}
      onAction={onPress}
      style={style}
    />
  );
}
