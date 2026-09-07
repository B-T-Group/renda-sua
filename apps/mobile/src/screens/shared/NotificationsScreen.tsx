import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useNotificationNavigation } from '../../hooks/useNotificationNavigation';
import type { UserMessage } from '../../types/messages';
import { spacing } from '../../theme';
import { formatDate } from '../../utils/formatters';
import { resolveMessageText } from '../../utils/resolveMessageText';

function EmptyState({ t }: { t: (key: string, fallback: string) => string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="bell-outline" size={56} color={colors.text.disabled} />
      <Text
        variant="bodyLarge"
        style={{ color: colors.text.secondary, marginTop: spacing.md, textAlign: 'center' }}
      >
        {t('notifications.center.empty', 'All caught up — no notifications yet.')}
      </Text>
    </View>
  );
}

function MessageRow({
  item,
  onPress,
  onMarkRead,
  navTarget,
}: {
  item: UserMessage;
  onPress: () => void;
  onMarkRead: () => void;
  navTarget: { label: string; navigate: () => void } | null;
}) {
  const { t } = useTranslation();
  const { colors: c, borderRadius: br } = useTheme();
  const isUnread = item.read_at === null;
  const displayText = resolveMessageText(item.message, t);

  return (
    <Pressable
      onPress={() => {
        if (isUnread) onMarkRead();
        onPress();
      }}
      style={[
        styles.row,
        {
          backgroundColor: isUnread ? c.primary.hover : c.surface,
          borderRadius: br.sm,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: c.primary.main,
        },
      ]}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowLeft}>
          <MaterialCommunityIcons
            name={isUnread ? 'bell-ring' : 'bell-outline'}
            size={20}
            color={isUnread ? c.primary.main : c.text.disabled}
            style={{ marginTop: 2 }}
          />
        </View>
        <View style={styles.rowText}>
          <Text
            variant="bodyMedium"
            style={{
              color: c.text.primary,
              fontWeight: isUnread ? '600' : '400',
            }}
            numberOfLines={3}
          >
            {displayText}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: c.text.secondary, marginTop: 4 }}
          >
            {formatDate(item.created_at, 'relative')}
          </Text>
        </View>
        {isUnread ? (
          <View
            style={[
              styles.unreadDot,
              { backgroundColor: c.primary.main },
            ]}
          />
        ) : null}
      </View>
      {navTarget ? (
        <Pressable
          onPress={() => {
            if (isUnread) onMarkRead();
            navTarget.navigate();
          }}
          style={[
            styles.navCta,
            {
              borderTopColor: c.divider,
              backgroundColor: c.pageBackground,
              borderBottomLeftRadius: br.sm,
              borderBottomRightRadius: br.sm,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t(`notifications.center.navLabel.${navTarget.label}`, 'View details')}
        >
          <Text variant="labelSmall" style={{ color: c.primary.main, fontWeight: '600', flex: 1 }}>
            {t(`notifications.center.navLabel.${navTarget.label}`, 'View details')}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={c.primary.main} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    messages,
    unreadCount,
    loading,
    refreshing,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const getNavTarget = useNotificationNavigation();
  const [noNavSnack, setNoNavSnack] = useState(false);

  const handleMessagePress = (msg: UserMessage) => {
    const target = getNavTarget(msg);
    if (target) {
      target.navigate();
      return;
    }
    setNoNavSnack(true);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: c.pageBackground },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
            backgroundColor: c.surface,
            borderBottomColor: c.divider,
          },
        ]}
      >
        <Text
          variant="headlineSmall"
          style={{ color: c.text.primary, flex: 1 }}
        >
          {t('notifications.center.title', 'Activity')}
        </Text>
        {unreadCount > 0 ? (
          <Button
            mode="text"
            compact
            onPress={() => void markAllRead()}
            style={{ marginRight: -8 }}
          >
            {t('notifications.center.markAllRead', 'Mark all read')}
          </Button>
        ) : null}
      </View>

      {loading && messages.length === 0 ? (
        <ActivityIndicator
          size="large"
          color={c.primary.main}
          style={{ marginTop: spacing.xl }}
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              colors={[c.primary.main]}
              tintColor={c.primary.main}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom: insets.bottom + spacing.xl,
              flexGrow: messages.length === 0 ? 1 : undefined,
            },
          ]}
          ListEmptyComponent={<EmptyState t={t} />}
          renderItem={({ item }) => (
            <MessageRow
              item={item}
              onPress={() => handleMessagePress(item)}
              onMarkRead={() => void markRead(item.id)}
              navTarget={getNavTarget(item)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: c.divider,
                marginHorizontal: spacing.md,
              }}
            />
          )}
        />
      )}
      <Snackbar
        visible={noNavSnack}
        onDismiss={() => setNoNavSnack(false)}
        duration={3000}
      >
        {t('notifications.center.noNavTarget', "This update can't be opened here.")}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  list: { paddingTop: spacing.xs },
  row: { marginHorizontal: spacing.sm, marginVertical: 2 },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowLeft: { paddingTop: 1 },
  rowText: { flex: 1, minWidth: 0 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  navCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl2,
  },
});
