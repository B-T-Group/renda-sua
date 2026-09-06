import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { PlatformPermissions } from '../../constants/platformPermissions';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  enqueueAdminItemCleanup,
  fetchAdminCatalogItem,
  updateAdminCatalogItem,
} from '../../services/adminCatalogItemsApi';
import type { AdminCatalogItemDetail } from '../../types/adminCatalogItems';

type DetailRoute = RouteProp<BusinessRootStackParamList, 'AdminItemDetail'>;

export default function AdminItemDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<DetailRoute>();
  const { itemId } = route.params;
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(
    PlatformPermissions.CATALOG_CROSS_BUSINESS,
    me
  );

  const [item, setItem] = useState<AdminCatalogItemDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupBusyId, setCleanupBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const applyItem = useCallback((next: AdminCatalogItemDetail) => {
    setItem(next);
    setName(next.name);
    setDescription(next.description ?? '');
    setPrice(next.price != null ? String(next.price) : '');
    setSku(next.sku ?? '');
    setIsActive(next.isActive);
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      if (!opts?.silent) setLoading(true);
      if (!opts?.silent) setError(null);
      try {
        const next = await fetchAdminCatalogItem(itemId);
        applyItem(next);
        setError(null);
      } catch (e: unknown) {
        const message =
          e instanceof Error
            ? e.message
            : t('admin.itemsBrowser.detailLoadError', 'Could not load item');
        if (opts?.silent) {
          setSnack(message);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyItem, canAccess, itemId, t]
  );

  useEffect(() => {
    if (!profileLoading && canAccess) void load();
  }, [canAccess, load, profileLoading]);

  const onSave = useCallback(async () => {
    if (!item) return;
    setSaving(true);
    try {
      const trimmedPrice = price.trim();
      const parsedPrice = trimmedPrice === '' ? null : Number(trimmedPrice);
      if (trimmedPrice !== '' && !Number.isFinite(parsedPrice)) {
        setSnack(
          t('admin.itemsBrowser.invalidPrice', 'Enter a valid price')
        );
        return;
      }
      const next = await updateAdminCatalogItem(item.id, {
        name: name.trim(),
        description,
        sku: sku.trim() || null,
        is_active: isActive,
        price: parsedPrice,
      });
      applyItem(next);
      setSnack(t('admin.itemsBrowser.saved', 'Item saved'));
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.itemsBrowser.saveError', 'Could not save item')
      );
    } finally {
      setSaving(false);
    }
  }, [applyItem, description, isActive, item, name, price, sku, t]);

  const onCleanup = useCallback(
    async (imageId: string, kind: 'rembg' | 'ai') => {
      if (!item) return;
      setCleanupBusyId(`${imageId}:${kind}`);
      try {
        await enqueueAdminItemCleanup(item.id, [{ imageId, kind }]);
        setSnack(
          kind === 'rembg'
            ? t(
                'admin.itemsBrowser.rembgQueued',
                'Background removal queued'
              )
            : t('admin.itemsBrowser.aiQueued', 'AI cleanup queued')
        );
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t('admin.itemsBrowser.cleanupError', 'Could not queue cleanup')
        );
        setCleanupBusyId(null);
        return;
      }
      try {
        await load({ silent: true });
      } catch {
        // Snack already handled inside silent load.
      } finally {
        setCleanupBusyId(null);
      }
    },
    [item, load, t]
  );

  if (profileLoading || loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text variant="titleMedium" style={{ color: colors.text.primary }}>
          {t('admin.itemsBrowser.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text style={{ color: colors.error.main }}>
          {error ?? t('admin.itemsBrowser.notFound', 'Item not found')}
        </Text>
        <Button mode="outlined" onPress={() => void load()} style={{ marginTop: 12 }}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
          />
        }
      >
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {item.business?.name ?? '—'}
        </Text>
        {item.moderationStatus ? (
          <StatusPill
            compact
            label={item.moderationStatus}
            backgroundColor={colors.pageBackground}
            textColor={colors.text.secondary}
          />
        ) : null}

        <TextInput
          mode="outlined"
          label={t('admin.itemsBrowser.fields.name', 'Name')}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          mode="outlined"
          label={t('admin.itemsBrowser.fields.description', 'Description')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
        <TextInput
          mode="outlined"
          label={t('admin.itemsBrowser.fields.price', 'Price')}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />
        <TextInput
          mode="outlined"
          label={t('admin.itemsBrowser.fields.sku', 'SKU')}
          value={sku}
          onChangeText={setSku}
        />
        <View style={styles.switchRow}>
          <Text style={[typography.body2, { color: colors.text.primary, flex: 1 }]}>
            {t('admin.itemsBrowser.fields.active', 'Active')}
          </Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
        <Button mode="contained" loading={saving} onPress={() => void onSave()}>
          {t('common.save', 'Save')}
        </Button>

        <Text style={[typography.subheading, { color: colors.text.primary }]}>
          {t('admin.itemsBrowser.imagesTitle', 'Images')}
        </Text>
        {(item.images ?? []).map((image) => (
          <View
            key={image.id}
            style={[
              styles.imageCard,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
              },
            ]}
          >
            {image.imageUrl ? (
              <Image
                source={{ uri: image.imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[styles.image, { backgroundColor: colors.pageBackground }]}
              />
            )}
            <Text
              style={[typography.caption, { color: colors.text.secondary }]}
            >
              {t('admin.itemsBrowser.activeVersion', 'Active: {{version}}', {
                version: image.activeVersion,
              })}
            </Text>
            <View style={styles.imageActions}>
              <Button
                mode="outlined"
                compact
                disabled={!!cleanupBusyId}
                loading={cleanupBusyId === `${image.id}:rembg`}
                onPress={() => void onCleanup(image.id, 'rembg')}
              >
                {t('admin.itemsBrowser.removeBg', 'Remove BG')}
              </Button>
              <Button
                mode="contained-tonal"
                compact
                disabled={!!cleanupBusyId}
                loading={cleanupBusyId === `${image.id}:ai`}
                onPress={() => void onCleanup(image.id, 'ai')}
              >
                {t('admin.itemsBrowser.aiCleanup', 'AI cleanup')}
              </Button>
            </View>
          </View>
        ))}
      </ScrollView>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageCard: {
    borderWidth: 1,
    gap: 8,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
});
