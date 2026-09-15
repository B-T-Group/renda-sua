import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { apiRequest } from '../../services/apiClient';

type ReelRow = {
  id: string;
  caption: string | null;
  moderation_status: string;
  thumbnail_url: string | null;
  business_id: string;
};

export default function AdminReelModerationScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { me } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS, me);
  const [rows, setRows] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await apiRequest<ReelRow[]>('/admin/reels/moderation?limit=50');
    setRows(Array.isArray(res) ? res : []);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  const moderate = async (id: string, status: 'approved' | 'rejected') => {
    await apiRequest(`/admin/reels/${id}/moderation`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason: status === 'rejected' ? 'Policy' : undefined }),
    });
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: spacing.lg }}>
          {t('admin.reels.moderation.empty', 'No reels awaiting review')}
        </Text>
      }
      renderItem={({ item }) => (
        <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12 }}>
          <Text variant="titleSmall">{item.caption || item.id}</Text>
          <Text variant="bodySmall">{item.moderation_status}</Text>
          <View style={styles.actions}>
            <Button compact onPress={() => void moderate(item.id, 'approved')}>
              {t('admin.reels.moderation.approve', 'Approve')}
            </Button>
            <Button compact onPress={() => void moderate(item.id, 'rejected')}>
              {t('admin.reels.moderation.reject', 'Reject')}
            </Button>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
