import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Divider, List, Switch, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import {
  useNotificationPreferences,
  type NotificationPreferencesPatch,
} from '../../hooks/useNotificationPreferences';
import { useRestockPreferences } from '../../hooks/useRestockPreferences';

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { flags } = useClientFlags();
  const { prefs, loading, saving, error, refresh, update } =
    useNotificationPreferences();
  // Gated by the client flag only: no restock request when it is off.
  const restockEnabled = flags.restock_alerts_v1 === true;
  const restock = useRestockPreferences(restockEnabled);

  const onToggle = (key: keyof NotificationPreferencesPatch, value: boolean) => {
    void update({ [key]: value }).catch(() => undefined);
  };

  const onRestockToggle = (key: 'push' | 'whatsapp' | 'sms', value: boolean) => {
    void restock.update({ [key]: value });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!prefs) {
    return (
      <View style={[styles.centered, { padding: spacing.md }]}>
        <Banner visible icon="alert">
          {error ||
            t(
              'notifications.preferences.loadFailed',
              'Could not load notification preferences.'
            )}
        </Banner>
        <Text
          variant="labelLarge"
          onPress={() => void refresh()}
          style={{ marginTop: spacing.md, color: colors.primary.main }}
        >
          {t('common.retry', 'Retry')}
        </Text>
      </View>
    );
  }

  const waBlocked = !prefs.phoneNumberVerified || !prefs.phoneNumber;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.lg,
        backgroundColor: colors.background.default,
      }}
    >
      <Text variant="titleLarge" style={{ marginBottom: spacing.sm }}>
        {t('notifications.preferences.title', 'Notification preferences')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {t(
          'notifications.preferences.subtitle',
          'Choose how Rendasua reaches you for orders, chat, and updates.'
        )}
      </Text>
      {error ? (
        <Banner visible icon="alert" style={{ marginBottom: spacing.sm }}>
          {error}
        </Banner>
      ) : null}
      {waBlocked ? (
        <Banner visible icon="cellphone-check" style={{ marginBottom: spacing.sm }}>
          {t(
            'notifications.preferences.whatsappNeedsPhone',
            'Verify your phone number in Profile before enabling WhatsApp.'
          )}
        </Banner>
      ) : null}

      <Text variant="labelLarge" style={styles.section}>
        {t('notifications.preferences.channels', 'Channels')}
      </Text>
      <PrefRow
        title={t('notifications.preferences.push', 'Push notifications')}
        value={prefs.pushEnabled}
        disabled={saving}
        onChange={(v) => onToggle('pushEnabled', v)}
      />
      <PrefRow
        title={t('notifications.preferences.email', 'Email')}
        value={prefs.emailEnabled}
        disabled={saving}
        onChange={(v) => onToggle('emailEnabled', v)}
      />
      <PrefRow
        title={t('notifications.preferences.sms', 'SMS (fallback)')}
        value={prefs.smsEnabled}
        disabled={saving}
        onChange={(v) => onToggle('smsEnabled', v)}
      />
      <PrefRow
        title={t('notifications.preferences.whatsapp', 'WhatsApp')}
        value={prefs.whatsappEnabled}
        disabled={saving || (waBlocked && !prefs.whatsappEnabled)}
        onChange={(v) => onToggle('whatsappEnabled', v)}
      />
      <PrefRow
        title={t(
          'notifications.preferences.whatsappInformational',
          'WhatsApp tips & digests (optional)'
        )}
        value={prefs.whatsappInformationalEnabled}
        disabled={saving || !prefs.whatsappEnabled}
        onChange={(v) => onToggle('whatsappInformationalEnabled', v)}
      />

      <Divider style={{ marginVertical: spacing.md }} />
      <Text variant="labelLarge" style={styles.section}>
        {t('notifications.preferences.categories', 'Categories')}
      </Text>
      <PrefRow
        title={t('notifications.preferences.orderUpdates', 'Order updates')}
        value={prefs.orderUpdates}
        disabled={saving}
        onChange={(v) => onToggle('orderUpdates', v)}
      />
      <PrefRow
        title={t('notifications.preferences.chat', 'Chat & mentions')}
        value={prefs.chat}
        disabled={saving}
        onChange={(v) => onToggle('chat', v)}
      />
      <PrefRow
        title={t('notifications.preferences.marketplace', 'Marketplace')}
        value={prefs.marketplace}
        disabled={saving}
        onChange={(v) => onToggle('marketplace', v)}
      />
      <PrefRow
        title={t('notifications.preferences.reminders', 'Reminders')}
        value={prefs.reminders}
        disabled={saving}
        onChange={(v) => onToggle('reminders', v)}
      />
      <PrefRow
        title={t('notifications.preferences.marketing', 'Marketing')}
        value={prefs.marketingEnabled}
        disabled={saving}
        onChange={(v) => onToggle('marketingEnabled', v)}
      />

      {restockEnabled ? (
        <>
          <Divider style={{ marginVertical: spacing.md }} />
          <Text variant="labelLarge" style={styles.section}>
            {t('restockAlerts.settingsTitle', 'Restock alerts')}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
          >
            {t('restockAlerts.settingsSubtitle', 'Items you liked that come back in stock')}
          </Text>
          {restock.error ? (
            <Banner
              visible
              icon="alert"
              style={{ marginBottom: spacing.sm }}
              actions={[
                { label: t('common.retry', 'Retry'), onPress: () => void restock.reload() },
              ]}
            >
              {restock.error}
            </Banner>
          ) : null}
          {restock.loading && !restock.preferences ? (
            <ActivityIndicator style={{ marginVertical: spacing.md }} />
          ) : null}
          {restock.preferences ? (
            <>
              <PrefRow
                title={t('notifications.preferences.push', 'Push notifications')}
                value={restock.preferences.push}
                disabled={restock.saving}
                onChange={(v) => onRestockToggle('push', v)}
              />
              <PrefRow
                title={t('notifications.preferences.whatsapp', 'WhatsApp')}
                value={restock.preferences.whatsapp}
                disabled={
                  restock.saving ||
                  (!restock.preferences.whatsapp_available && !restock.preferences.whatsapp)
                }
                onChange={(v) => onRestockToggle('whatsapp', v)}
              />
              <PrefRow
                title={t('notifications.preferences.sms', 'SMS (fallback)')}
                value={restock.preferences.sms}
                disabled={
                  restock.saving ||
                  (!restock.preferences.sms_available && !restock.preferences.sms)
                }
                onChange={(v) => onRestockToggle('sms', v)}
              />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function PrefRow(props: {
  title: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <List.Item
      title={props.title}
      right={() => (
        <Switch
          value={props.value}
          disabled={props.disabled}
          onValueChange={props.onChange}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 4, opacity: 0.7 },
});
