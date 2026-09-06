import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import type {
  AdminOrderContact,
  OrderContactRole,
} from '../../../types/adminOrders';
import { escalationRepliesForRole } from '../../../utils/adminOrderEscalationReplies';
import { contactRoleLabel } from '../../../utils/adminOrderRisk';

type Channel = 'message' | 'sms';

export interface AdminOrderContactSheetProps {
  visible: boolean;
  contact: AdminOrderContact | null;
  submitting: boolean;
  onDismiss: () => void;
  onSend: (
    role: OrderContactRole,
    channel: Channel,
    message: string
  ) => Promise<void>;
}

export function AdminOrderContactSheet({
  visible,
  contact,
  submitting,
  onDismiss,
  onSend,
}: AdminOrderContactSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [channel, setChannel] = useState<Channel>('message');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBody('');
    setError(null);
    setChannel(contact?.can_message ? 'message' : 'sms');
  }, [visible, contact]);

  if (!contact) return null;

  const replies = escalationRepliesForRole(contact.role);
  const canSend =
    !submitting &&
    body.trim().length > 0 &&
    (channel === 'message' ? contact.can_message : contact.can_sms);

  const handleSend = async () => {
    setError(null);
    try {
      await onSend(contact.role, channel, body.trim());
      setBody('');
      onDismiss();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.orders.actionFailed', 'Action failed')
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel', 'Cancel')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm }}
          >
            <Text variant="titleLarge">
              {contactRoleLabel(t, contact.role)}
            </Text>
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {contact.name ??
                t('admin.orders.unnamedContact', 'Name unavailable')}
            </Text>

            {contact.phone ? (
              <Button
                mode="contained-tonal"
                icon="phone"
                onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
              >
                {t('admin.orders.call', 'Call')} {contact.phone}
              </Button>
            ) : null}

            <SegmentedButtons
              value={channel}
              onValueChange={(value) => setChannel(value as Channel)}
              buttons={[
                {
                  value: 'message',
                  label: t('admin.orders.inApp', 'In-app'),
                  disabled: !contact.can_message,
                },
                {
                  value: 'sms',
                  label: t('admin.orders.sms', 'SMS'),
                  disabled: !contact.can_sms,
                },
              ]}
            />

            {channel === 'message' && !contact.can_message ? (
              <Text
                style={[typography.caption, { color: colors.text.secondary }]}
              >
                {t(
                  'admin.orders.messageUnavailable',
                  'In-app messaging needs a linked account.'
                )}
              </Text>
            ) : null}
            {channel === 'sms' && !contact.can_sms ? (
              <Text
                style={[typography.caption, { color: colors.text.secondary }]}
              >
                {t(
                  'admin.orders.noPhone',
                  'This participant has no phone on file.'
                )}
              </Text>
            ) : null}

            {replies.length > 0 ? (
              <View style={styles.chipRow}>
                {replies.map((reply) => {
                  const replyBody = t(reply.bodyKey, reply.bodyDefault);
                  const selected = body === replyBody;
                  return (
                    <Button
                      key={reply.id}
                      mode={selected ? 'contained-tonal' : 'outlined'}
                      compact
                      onPress={() => setBody(replyBody)}
                      style={styles.chip}
                    >
                      {t(reply.labelKey, reply.labelDefault)}
                    </Button>
                  );
                })}
              </View>
            ) : null}

            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={body}
              onChangeText={setBody}
              label={t('admin.orders.message', 'Message')}
            />

            {error ? (
              <Text style={[typography.caption, { color: colors.error.main }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button mode="text" onPress={onDismiss} disabled={submitting}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={() => void handleSend()}
                disabled={!canSend}
                loading={submitting}
                contentStyle={styles.confirmContent}
              >
                {t('admin.orders.sendMessage', 'Send message')}
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: { marginHorizontal: 12, marginBottom: 12, padding: 20 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: { marginBottom: 0 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  confirmContent: { minHeight: 44 },
});
