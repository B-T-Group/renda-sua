import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { NudgeDefinition } from '../../services/nudges/NudgeService';
import {
  trackNudgeClicked,
  trackNudgeDismissed,
  trackNudgeShown,
} from '../../utils/ftueAnalytics';

type Props = {
  nudge: NudgeDefinition;
  onAction: () => void;
  onDismiss: () => void;
  illustration?: React.ReactNode;
};

export function ContextualNudgeCard({
  nudge,
  onAction,
  onDismiss,
  illustration,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackNudgeShown(nudge.id);
  }, [nudge.id]);

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      {illustration ? <View style={styles.art}>{illustration}</View> : null}
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t(nudge.titleKey, nudge.titleDefault)}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t(nudge.messageKey, nudge.messageDefault)}
      </Text>
      <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.xs }]}>
        <Button
          mode="text"
          onPress={() => {
            trackNudgeDismissed(nudge.id);
            onDismiss();
          }}
          contentStyle={styles.actionHit}
        >
          {t('ftue.nudges.dismiss', 'Not now')}
        </Button>
        <Button
          mode="contained"
          onPress={() => {
            trackNudgeClicked(nudge.id);
            onAction();
          }}
          contentStyle={styles.actionHit}
        >
          {t(nudge.ctaKey, nudge.ctaDefault)}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  art: { alignItems: 'center', marginBottom: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionHit: { minHeight: 44 },
});
