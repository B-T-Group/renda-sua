import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import {
  fetchContentReportsQueue,
  resolveContentReport,
  type ContentReportRow,
} from '../../services/adminContentReportsApi';

export default function AdminContentReportsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { me } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS, me);
  const [rows, setRows] = useState<ContentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchContentReportsQueue({ status: 'pending', limit: 50 });
    setRows(data.rows);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onResolve = async (
    id: string,
    action: 'dismiss' | 'hide_content' | 'warn_merchant'
  ) => {
    await resolveContentReport(id, action);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{t('admin.accessDenied', 'Access denied')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: spacing.lg }}>
          {t('admin.contentReports.empty', 'No pending reports')}
        </Text>
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 12,
            gap: spacing.xs,
          }}
        >
          <Text variant="titleSmall">
            {item.subject_type} · {item.reason}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {item.details || item.subject_id}
          </Text>
          <View style={styles.actions}>
            <Button compact onPress={() => void onResolve(item.id, 'dismiss')}>
              {t('admin.contentReports.dismiss', 'Dismiss')}
            </Button>
            <Button compact onPress={() => void onResolve(item.id, 'hide_content')}>
              {t('admin.contentReports.hide', 'Hide content')}
            </Button>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
