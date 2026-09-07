import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { GhostButton } from '../common/AppButton';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface ReviewSummaryCardProps {
  title: string;
  icon: IconName;
  iconColor?: string;
  badge?: React.ReactNode;
  delayMs?: number;
  onEdit: () => void;
  children: React.ReactNode;
}

function useCardEnter(delayMs: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: delayMs,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay: delayMs,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delayMs, opacity, translateY]);

  return { opacity, translateY };
}

function ReviewIconBadge({
  icon,
  iconColor,
  badge,
}: {
  icon: IconName;
  iconColor: string;
  badge?: React.ReactNode;
}) {
  const { colors, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.primaryTint,
          borderRadius: borderRadius.full,
        },
      ]}
    >
      {badge ?? <MaterialCommunityIcons name={icon} size={22} color={iconColor} />}
    </View>
  );
}

export function ReviewDetailRow({
  icon,
  children,
}: {
  icon: IconName;
  children: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.detailRow, { gap: spacing.xs }]}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.text.secondary} />
      <View style={styles.detailText}>{children}</View>
    </View>
  );
}

export function ReviewSummaryCard({
  title,
  icon,
  iconColor,
  badge,
  delayMs = 0,
  onEdit,
  children,
}: ReviewSummaryCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const enter = useCardEnter(delayMs);
  const accent = iconColor ?? colors.primary.main;

  return (
    <Animated.View
      style={[
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          opacity: enter.opacity,
          transform: [{ translateY: enter.translateY }],
        },
      ]}
    >
      <View style={[styles.body, { padding: spacing.md, gap: spacing.sm }]}>
        <ReviewIconBadge icon={icon} iconColor={accent} badge={badge} />
        <View style={[styles.content, { gap: spacing.xs }]}>
          <View style={styles.header}>
            <Text style={[typography.subheading, { color: colors.text.primary, flex: 1 }]}>
              {title}
            </Text>
            <GhostButton label={t('common.edit', 'Edit')} onPress={onEdit} size="medium" />
          </View>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'flex-start' },
  badge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailText: { flex: 1, minWidth: 0 },
});
