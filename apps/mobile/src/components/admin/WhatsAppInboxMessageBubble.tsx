import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { WhatsAppInboxAttachment } from './WhatsAppInboxAttachment';
import { WhatsAppInboxRichText } from './WhatsAppInboxRichText';
import { useTheme } from '../../contexts/ThemeContext';
import type { WhatsAppInboxMessage } from '../../types/whatsappInbox';
import { isWhatsAppPlaceholderBody } from '../../utils/whatsappInboxMedia';

interface Props {
  message: WhatsAppInboxMessage;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function bubbleText(message: WhatsAppInboxMessage, empty: string): string | null {
  const caption = message.media?.caption?.trim();
  if (caption) return caption;
  if (message.body && !isWhatsAppPlaceholderBody(message.body)) {
    return message.body;
  }
  if (!message.media?.id && message.media?.latitude == null) {
    return message.body || empty;
  }
  return null;
}

export function WhatsAppInboxMessageBubble({ message }: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const inbound = message.direction === 'inbound';
  const text = bubbleText(
    message,
    t('admin.whatsappInbox.emptyBody', '(empty)')
  );

  return (
    <View
      style={[
        styles.bubbleWrap,
        { alignItems: inbound ? 'flex-start' : 'flex-end' },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: inbound
              ? colors.background.paper
              : colors.primary.main,
            borderColor: colors.divider,
            borderRadius: borderRadius.lg,
            maxWidth: '85%',
          },
        ]}
      >
        <WhatsAppInboxAttachment message={message} inbound={inbound} />
        {text ? (
          <WhatsAppInboxRichText
            text={text}
            color={inbound ? colors.text.primary : colors.primary.contrast}
            linkColor={inbound ? colors.primary.main : colors.primary.contrast}
            style={typography.body2}
          />
        ) : null}
        <Text
          style={[
            typography.caption,
            {
              color: inbound ? colors.text.secondary : colors.primary.contrast,
              opacity: inbound ? 1 : 0.85,
              marginTop: 4,
            },
          ]}
        >
          {inbound
            ? formatWhen(message.createdAt)
            : `${message.senderDisplayName || t('admin.whatsappInbox.agent', 'Agent')} · ${formatWhen(message.createdAt)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: { marginBottom: 10, width: '100%' },
  bubble: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
