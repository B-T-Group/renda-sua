import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, HelperText, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { OperatingHoursEditor } from '../../components/business/OperatingHoursEditor';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/businessApi';
import { spacing } from '../../theme/spacing';
import {
  editorRowsToOperatingHours,
  isValidOpenCloseWindow,
  operatingHoursToEditorRows,
  type OperatingHoursEditorRow,
} from '../../utils/operatingHours';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'BusinessLocationHours'>;

function HoursScreenSkeleton() {
  const { colors, borderRadius, spacing: sp } = useTheme();
  const bone = { backgroundColor: colors.divider };
  return (
    <View style={{ padding: sp.md, gap: sp.sm }}>
      <View style={[styles.skelLine, bone, { width: '55%', borderRadius: 4 }]} />
      <View style={[styles.skelLine, bone, { width: '80%', borderRadius: 4, height: 12 }]} />
      <View
        style={[
          styles.skelCard,
          {
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: sp.md,
            gap: sp.md,
          },
        ]}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <View key={`hours-skel-${i}`} style={styles.skelRow}>
            <View style={[styles.skelDay, bone, { borderRadius: 4 }]} />
            <View style={[styles.skelSwitch, bone, { borderRadius: borderRadius.full }]} />
            <View style={{ flex: 1 }} />
            <View style={[styles.skelTime, bone, { borderRadius: borderRadius.sm }]} />
            <View style={[styles.skelTime, bone, { borderRadius: borderRadius.sm }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function BusinessLocationHoursScreen({ route, navigation }: Props) {
  const { locationId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [rows, setRows] = useState<OperatingHoursEditorRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasInvalidWindow = useMemo(
    () => rows.some((row) => row.enabled && !isValidOpenCloseWindow(row.open, row.close)),
    [rows]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReady(false);
    try {
      const res = await businessApi.locations.list();
      const location = res.data?.business_locations?.find((loc) => loc.id === locationId);
      if (!location) {
        setError(
          t('business.locations.operatingHours.loadError', 'Could not load location hours')
        );
        return;
      }
      setLocationName(location.name);
      setRows(operatingHoursToEditorRows(location.operating_hours));
      setReady(true);
      navigation.setOptions({
        title: t('business.locations.operatingHours.title', 'Operating hours'),
      });
    } catch {
      setError(
        t('business.locations.operatingHours.loadError', 'Could not load location hours')
      );
    } finally {
      setLoading(false);
    }
  }, [locationId, navigation, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!ready || hasInvalidWindow) return;
    setSaving(true);
    setError(null);
    try {
      const operatingHours = editorRowsToOperatingHours(rows);
      await businessApi.orders.updateLocationHours(
        locationId,
        operatingHours as unknown as Record<string, unknown>
      );
      navigation.navigate('BusinessLocationsList', { hoursUpdated: true });
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('business.locations.operatingHours.saveError', 'Failed to save operating hours')
      );
    } finally {
      setSaving(false);
    }
  }, [hasInvalidWindow, locationId, navigation, ready, rows, t]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
        <HoursScreenSkeleton />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.container, styles.content, { backgroundColor: colors.pageBackground }]}>
        <HelperText type="error" visible>
          {error ??
            t('business.locations.operatingHours.loadError', 'Could not load location hours')}
        </HelperText>
        <Button mode="contained" onPress={() => void load()} style={styles.save}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <KeyboardAwareScrollView
        avoidingViewStyle={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 88 + Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {locationName ? (
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {locationName}
          </Text>
        ) : null}
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
        >
          {t(
            'business.locations.operatingHours.subtitle',
            'Set the days and hours this location is open for orders.'
          )}
        </Text>
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <OperatingHoursEditor value={rows} onChange={setRows} />
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
          },
        ]}
      >
        {hasInvalidWindow ? (
          <Text variant="labelSmall" style={{ color: colors.error.main, marginBottom: 6 }}>
            {t(
              'business.locations.operatingHours.fixInvalidWindows',
              'Fix invalid open/close times before saving.'
            )}
          </Text>
        ) : null}
        <Button
          mode="contained"
          loading={saving}
          disabled={saving || hasInvalidWindow}
          onPress={() => void save()}
        >
          {t('common.save', 'Save')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.xs },
  save: { marginTop: spacing.md },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skelLine: { height: 16 },
  skelCard: { borderWidth: StyleSheet.hairlineWidth },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skelDay: { width: 36, height: 14 },
  skelSwitch: { width: 40, height: 24 },
  skelTime: { width: 64, height: 32 },
});
