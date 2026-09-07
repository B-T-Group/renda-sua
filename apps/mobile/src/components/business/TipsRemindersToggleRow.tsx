import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { merchantEngagementApi } from '../../services/merchantEngagementApi';
import { notifyTipsRemindersChanged } from '../../utils/tipsRemindersSync';

export function TipsRemindersToggleRow() {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void merchantEngagementApi
      .getTipsReminders()
      .then((res) => {
        if (active) setEnabled(res.data?.tips_reminders_enabled !== false);
      })
      .catch(() => {
        /* keep default on */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onToggle = useCallback(async (value: boolean) => {
    setEnabled(value);
    notifyTipsRemindersChanged(value);
    try {
      const res = await merchantEngagementApi.setTipsReminders(value);
      const next = res.data?.tips_reminders_enabled !== false;
      setEnabled(next);
      notifyTipsRemindersChanged(next);
    } catch {
      setEnabled((prev) => !value);
      notifyTipsRemindersChanged(!value);
    }
  }, []);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.primaryTint,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="bell-badge-outline"
          size={22}
          color={colors.primary.main}
        />
      </View>
      <View style={styles.body}>
        <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
          {t('business.engagement.tipsReminders', 'Store tips & reminders')}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t(
            'business.engagement.tipsRemindersSubtitle',
            'Dashboard tips, push nudges, and weekly digest emails'
          )}
        </Text>
      </View>
      <Switch value={enabled} onValueChange={onToggle} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
});
