import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type {
  ClientHomeOrderCardModel,
  ClientHomeOrderCardUrgency,
} from '../../utils/buildClientHomeOrderCardModel';

export interface ClientHomeOrderCardProps {
  model: ClientHomeOrderCardModel;
  width: number;
  onPressCard: () => void;
  onPressCta: () => void;
}

function urgencyBorder(
  urgency: ClientHomeOrderCardUrgency,
  colors: ReturnType<typeof useTheme>['colors']
): string {
  if (urgency === 'warning') return colors.warning.main;
  if (urgency === 'primary') return colors.primary.main;
  if (urgency === 'info') return colors.info.main;
  return colors.divider;
}

export function ClientHomeOrderCard({
  model,
  width,
  onPressCard,
  onPressCta,
}: ClientHomeOrderCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const borderColor = urgencyBorder(model.urgency, colors);
  const title = t(model.titleKey, model.titleDefault, model.interpolation);
  const subtitle = t(model.subtitleKey, model.subtitleDefault, model.interpolation);
  const cta = t(model.ctaKey, model.ctaDefault, model.interpolation);
  const cardWidth = useMemo(
    () => Math.max(0, width - spacing.md * 2),
    [width, spacing.md]
  );

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          width: cardWidth,
          marginHorizontal: spacing.md,
          borderRadius: borderRadius.lg,
          borderColor,
          backgroundColor: colors.background.paper,
        },
      ]}
    >
      <Pressable
        onPress={onPressCard}
        accessibilityRole="button"
        accessibilityLabel={t(
          'client.home.liveOrders.cardA11y',
          'Order {{number}}, {{title}}',
          { number: model.orderNumber, title }
        )}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.96 : 1, padding: spacing.md },
        ]}
      >
        <View style={styles.topRow}>
          <Text
            variant="labelMedium"
            style={{ color: colors.text.secondary, flexShrink: 0 }}
          >
            #{model.orderNumber}
          </Text>
          <StatusPill
            label={title}
            backgroundColor={`${colors.primary.main}18`}
            textColor={colors.primary.main}
            compact
            style={{ maxWidth: '70%' }}
          />
        </View>
        <Text
          variant="bodySmall"
          numberOfLines={2}
          style={{ color: colors.text.secondary, marginTop: spacing.xs }}
        >
          {subtitle}
        </Text>
        <Button
          mode="contained"
          onPress={onPressCta}
          style={{ marginTop: spacing.sm }}
          contentStyle={{ height: 40 }}
        >
          {cta}
        </Button>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: {
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
