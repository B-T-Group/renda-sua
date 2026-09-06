import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useWhatsAppInboxList } from '../../hooks/useWhatsAppInboxList';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type {
  WhatsAppInboxConversation,
  WhatsAppInboxStatus,
} from '../../types/whatsappInbox';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'AdminWhatsAppInbox'
>;

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminWhatsAppInboxScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const list = useWhatsAppInboxList();

  const openThread = useCallback(
    (item: WhatsAppInboxConversation) => {
      void list.markRead(item.id);
      navigation.navigate('AdminWhatsAppConversation', {
        conversationId: item.id,
      });
    },
    [list, navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: WhatsAppInboxConversation }) => {
      const title =
        item.userDisplayName ||
        `+${item.customerPhone.replace(/^\+/, '')}`;
      return (
        <Pressable
          onPress={() => openThread(item)}
          style={[
            styles.card,
            shadows.sm,
            {
              backgroundColor: colors.background.paper,
              borderColor: colors.divider,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text
              variant="titleMedium"
              style={{ color: colors.text.primary, flex: 1, minWidth: 0 }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {item.unreadCount > 0 ? (
              <StatusPill
                label={String(item.unreadCount)}
                backgroundColor={colors.infoTint}
                textColor={colors.info.main}
                compact
              />
            ) : null}
          </View>
          <Text
            style={[typography.body2, { color: colors.text.secondary }]}
            numberOfLines={2}
          >
            {item.lastMessagePreview ||
              t('admin.whatsappInbox.noPreview', 'No messages yet')}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[typography.caption, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              {formatWhen(item.lastMessageAt)}
            </Text>
            {!item.canReply ? (
              <Text
                style={[typography.caption, { color: colors.warning.main }]}
              >
                {t('admin.whatsappInbox.sessionClosed', 'Window closed')}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [borderRadius.lg, colors, openThread, shadows.sm, spacing, t, typography]
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
          {t('admin.whatsappInbox.accessDenied', 'Access denied')}
        </Text>
        <Text
          style={[
            typography.body2,
            {
              color: colors.text.secondary,
              textAlign: 'center',
              marginTop: spacing.xs,
            },
          ]}
        >
          {t(
            'admin.whatsappInbox.accessDeniedHelp',
            'WhatsApp inbox needs the whatsapp manager role or superuser access.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <SegmentedButtons
          value={list.status}
          onValueChange={(v) =>
            list.setStatus(v as WhatsAppInboxStatus | 'all')
          }
          buttons={[
            {
              value: 'open',
              label: t('admin.whatsappInbox.filterOpen', 'Open'),
            },
            {
              value: 'closed',
              label: t('admin.whatsappInbox.filterClosed', 'Closed'),
            },
            {
              value: 'all',
              label: t('admin.whatsappInbox.filterAll', 'All'),
            },
          ]}
        />
        <RNTextInput
          value={list.search}
          onChangeText={list.setSearch}
          placeholder={t(
            'admin.whatsappInbox.searchPlaceholder',
            'Search phone or name'
          )}
          placeholderTextColor={colors.text.secondary}
          style={[
            styles.search,
            {
              borderColor: colors.divider,
              backgroundColor: colors.background.paper,
              color: colors.text.primary,
              borderRadius: borderRadius.md,
              marginTop: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
          returnKeyType="search"
          onSubmitEditing={() => list.refresh()}
        />
        {!list.configured ? (
          <Text
            style={[
              typography.caption,
              { color: colors.warning.main, marginTop: spacing.xs },
            ]}
          >
            {t(
              'admin.whatsappInbox.notConfigured',
              'WhatsApp Cloud API is not fully configured on the server.'
            )}
          </Text>
        ) : null}
      </View>

      {list.loading && !list.refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: spacing.xl,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={list.refresh}
            />
          }
          ListEmptyComponent={
            <Text
              style={[
                typography.body2,
                { color: colors.text.secondary, textAlign: 'center' },
              ]}
            >
              {list.error ||
                t('admin.whatsappInbox.empty', 'No conversations yet')}
            </Text>
          }
          ListHeaderComponent={
            list.total > 0 ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.text.secondary, marginBottom: spacing.sm },
                ]}
              >
                {t('admin.whatsappInbox.count', '{{count}} conversations', {
                  count: list.total,
                })}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  search: {
    borderWidth: 1,
    minHeight: 44,
  },
});
