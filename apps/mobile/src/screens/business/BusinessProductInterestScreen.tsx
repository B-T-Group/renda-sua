import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useProductInterest } from '../../hooks/useProductInterest';
import type { ProductInterestRow } from '../../services/productInterestApi';
import { useTheme } from '../../contexts/ThemeContext';

function contactLine(row: ProductInterestRow): string {
  const u = row.client_user;
  if (!u) return '—';
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return [name || null, u.phone_number, u.email].filter(Boolean).join(' · ');
}

export default function BusinessProductInterestScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<any>();
  const { listBusiness } = useProductInterest();
  const [rows, setRows] = useState<ProductInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBusiness(1, 50);
      setRows(data?.items ?? []);
    } catch {
      setError(t('productInterest.loadError', 'Could not load interest leads'));
    } finally {
      setLoading(false);
    }
  }, [listBusiness, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && rows.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      data={rows}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} />
      }
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.md }}>
          <Text variant="headlineSmall">
            {t('productInterest.businessTitle', 'Product interest')}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t(
              'productInterest.businessHelp',
              'Clients asked to be contacted about these items. Follow up by phone or email outside the app.'
            )}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.text.secondary }}>
          {error ||
            t('productInterest.emptyBusiness', 'No interest leads yet.')}
        </Text>
      }
      renderItem={({ item }) => {
        const phone = item.client_user?.phone_number;
        const email = item.client_user?.email;
        const catalogItemId = item.item?.id;
        return (
          <View
            style={{
              padding: spacing.md,
              borderRadius: borderRadius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.divider,
            }}
          >
            <Text variant="titleMedium">
              {item.item?.name || t('productInterest.unknownItem', 'Item')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {item.business_location?.name || '—'}
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: spacing.xs }}>
              {t('productInterest.clientLabel', 'Client')}: {contactLine(item)}
            </Text>
            {item.client_note ? (
              <Text variant="bodyMedium">{item.client_note}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {phone ? (
                <Button mode="text" onPress={() => void Linking.openURL(`tel:${phone}`)}>
                  {phone}
                </Button>
              ) : null}
              {email ? (
                <Button
                  mode="text"
                  onPress={() => void Linking.openURL(`mailto:${email}`)}
                >
                  {email}
                </Button>
              ) : null}
              {catalogItemId ? (
                <Button
                  mode="text"
                  onPress={() =>
                    navigation.navigate('BusinessItemDetail', {
                      itemId: catalogItemId,
                    })
                  }
                >
                  {t('productInterest.viewItem', 'View item')}
                </Button>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}
