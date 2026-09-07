import React, { useCallback } from 'react';
import { Linking, Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import {
  parseWhatsAppRichText,
  type WhatsAppRichSegment,
} from '../../utils/whatsappInboxRichText';

interface Props {
  text: string;
  color: string;
  linkColor: string;
  style?: StyleProp<TextStyle>;
}

export function WhatsAppInboxRichText({
  text,
  color,
  linkColor,
  style,
}: Props) {
  const segments = parseWhatsAppRichText(text);
  const openUrl = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);
  return (
    <Text selectable style={[style, { color }]}>
      {segments.map((segment, index) => (
        <RichRun
          key={`${index}-${segment.text.slice(0, 12)}`}
          segment={segment}
          color={color}
          linkColor={linkColor}
          onOpenUrl={openUrl}
        />
      ))}
    </Text>
  );
}

function RichRun({
  segment,
  color,
  linkColor,
  onOpenUrl,
}: {
  segment: WhatsAppRichSegment;
  color: string;
  linkColor: string;
  onOpenUrl: (url: string) => void;
}) {
  const isLink = !!segment.url;
  return (
    <Text
      style={[
        segment.bold ? styles.bold : null,
        segment.italic ? styles.italic : null,
        segment.strike ? styles.strike : null,
        segment.mono ? styles.mono : null,
        isLink ? { color: linkColor, textDecorationLine: 'underline' } : { color },
      ]}
      onPress={isLink ? () => onOpenUrl(segment.url as string) : undefined}
      accessibilityRole={isLink ? 'link' : undefined}
    >
      {segment.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
