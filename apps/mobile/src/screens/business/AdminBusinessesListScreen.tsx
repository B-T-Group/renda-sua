import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { AdminBusinessCard } from '../../components/admin/AdminBusinessCard';
import { AdminBusinessFilters } from '../../components/admin/AdminBusinessFilters';
import { useAdminBusinessesList } from '../../hooks/useAdminBusinessesList';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { AdminBusinessListItem } from '../../types/adminBusinesses';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'AdminBusinessesList'
>;

export default function AdminBusinessesListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const list = useAdminBusinessesList({
    initialIdDocumentStatus: 'not_approved',
  });

  const renderItem = useCallback(
    ({ item }: { item: AdminBusinessListItem }) => (
      <AdminBusinessCard
        item={item}
        showRail
        onVerify={(businessId) =>
          navigation.navigate('AdminBusinessVerification', { businessId })
        }
        onApplyReferral={list.applyReferral}
      />
    ),
    [navigation, list.applyReferral]
  );

  if (list.profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!list.canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text
          variant="titleMedium"
          style={{ color: colors.text.primary, textAlign: 'center' }}
        >
          {t('admin.businesses.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={[typography.body2, { color: colors.text.secondary }]}>
          {t(
            'admin.businesses.subtitle',
            'Review merchant contracts, ID documents, and payment readiness.'
          )}
        </Text>
        <RNTextInput
          value={list.search}
          onChangeText={list.onSearchChange}
          placeholder={t('common.search', 'Search')}
          placeholderTextColor={colors.text.secondary}
          style={{
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text.primary,
            backgroundColor: colors.surface,
          }}
          onSubmitEditing={list.commitSearch}
          returnKeyType="search"
        />
        <Button mode="contained-tonal" onPress={list.commitSearch}>
          {t('common.search', 'Search')}
        </Button>

        <AdminBusinessFilters
          lifecycleStatus={list.lifecycleStatus}
          idDocumentStatus={list.idDocumentStatus}
          needsAttention={list.needsAttention}
          onLifecycleChange={(v) => list.applyFilter('lifecycle', v)}
          onIdDocumentChange={(v) => list.applyFilter('idDoc', v)}
          onNeedsAttentionChange={(v) => list.applyFilter('attention', v)}
        />
      </View>

      {list.loading && !list.refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.md,
            gap: spacing.md,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={list.refresh}
            />
          }
          ListEmptyComponent={
            <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {list.error ||
                (list.hasActiveFilters
                  ? t(
                      'admin.businesses.emptyFiltered',
                      'No businesses match these filters.'
                    )
                  : t('admin.businesses.empty', 'No businesses found.'))}
            </Text>
          }
          renderItem={renderItem}
          ListFooterComponent={
            list.totalPages > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: spacing.md,
                }}
              >
                <Button
                  disabled={list.page <= 1}
                  onPress={() => list.setPage(Math.max(1, list.page - 1))}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {t('admin.businesses.pageOf', 'Page {{page}} of {{total}}', {
                    page: list.page,
                    total: list.totalPages,
                  })}
                </Text>
                <Button
                  disabled={list.page >= list.totalPages}
                  onPress={() =>
                    list.setPage(Math.min(list.totalPages, list.page + 1))
                  }
                >
                  {t('common.next', 'Next')}
                </Button>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
