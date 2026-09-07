import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onDismiss: () => void;
  onConfirm: (hhMm: string) => void;
};

function parseHhMm(value: string): { hour: string; minute: string } {
  const [h = '08', m = '00'] = value.split(':');
  const hour = HOURS.includes(h) ? h : '08';
  const rounded =
    MINUTES.find((opt) => opt === m) ??
    MINUTES.reduce((best, opt) =>
      Math.abs(Number(opt) - Number(m)) < Math.abs(Number(best) - Number(m))
        ? opt
        : best
    );
  return { hour, minute: rounded };
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: selected ? colors.primary.main : colors.pageBackground,
          borderColor: selected ? colors.primary.main : colors.divider,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        variant="labelLarge"
        style={{
          color: selected ? colors.primary.contrast : colors.text.primary,
          fontWeight: selected ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function OperatingHoursTimeSheet({
  visible,
  title,
  value,
  onDismiss,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const initial = useMemo(() => parseHhMm(value), [value]);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  useEffect(() => {
    if (!visible) return;
    const next = parseHhMm(value);
    setHour(next.hour);
    setMinute(next.minute);
  }, [visible, value]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.75,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleMedium"
            style={{ color: colors.text.primary, fontWeight: '700', paddingHorizontal: spacing.md }}
          >
            {title}
          </Text>
          <Text
            variant="headlineSmall"
            style={{
              color: colors.primary.main,
              fontWeight: '700',
              textAlign: 'center',
              marginTop: spacing.sm,
            }}
          >
            {hour}:{minute}
          </Text>

          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
            <View>
              <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
                {t('business.locations.operatingHours.hour', 'Hour')}
              </Text>
              <View style={styles.chipWrap}>
                {HOURS.map((h) => (
                  <Chip key={h} label={h} selected={hour === h} onPress={() => setHour(h)} />
                ))}
              </View>
            </View>
            <View>
              <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
                {t('business.locations.operatingHours.minute', 'Minute')}
              </Text>
              <View style={styles.chipWrap}>
                {MINUTES.map((m) => (
                  <Chip key={m} label={m} selected={minute === m} onPress={() => setMinute(m)} />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.actions, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
            <Button mode="text" onPress={onDismiss} style={styles.actionBtn}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => onConfirm(`${hour}:${minute}`)}
              style={styles.actionBtn}
            >
              {t('common.done', 'Done')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingTop: 16,
    overflow: 'hidden',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 48,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: { minWidth: 96 },
});
