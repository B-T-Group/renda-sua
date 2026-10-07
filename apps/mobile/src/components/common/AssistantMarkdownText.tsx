import React, { useCallback } from 'react';
import { Linking, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/contexts/ThemeContext';
import {
  parseAssistantMarkdown,
  type AssistantMdInline,
} from '@/utils/assistantMarkdown';
import type { ClientRootStackParamList } from '@/navigation/types';
import { trackSiteEvent } from '@/services/AppEventsService';

type Nav = NativeStackNavigationProp<ClientRootStackParamList>;

type Props = {
  content: string;
  color: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  /** Optional handler for special link patterns (e.g., reorder links) */
  onLinkPress?: (url: string) => boolean;
};

function InlineRuns({
  inlines,
  color,
  style,
  onLinkPress,
}: {
  inlines: AssistantMdInline[];
  color: string;
  style?: TextStyle;
  onLinkPress?: (url: string) => boolean;
}) {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const handleLinkPress = useCallback((url: string) => {
    trackSiteEvent({
      eventType: 'assistant.deeplink.tap',
      metadata: { url },
    });

    // Allow parent to handle special URLs (e.g., reorder links)
    if (onLinkPress && onLinkPress(url)) {
      return;
    }

    // Try in-app navigation for known routes
    const itemMatch = url.match(/\/items\/([^/?]+)/);
    if (itemMatch) {
      const inventoryItemId = itemMatch[1];
      navigation.navigate('InventoryItemDetail', { inventoryItemId });
      return;
    }

    // Fall back to external browser for unknown URLs
    void Linking.openURL(url);
  }, [navigation, onLinkPress]);

  return (
    <Text style={[styles.body, { color }, style]}>
      {inlines.map((part, index) => {
        if (part.type === 'bold') {
          return (
            <Text key={index} style={[styles.body, styles.bold, { color }]}>
              {part.text}
            </Text>
          );
        }
        if (part.type === 'italic') {
          return (
            <Text key={index} style={[styles.body, styles.italic, { color }]}>
              {part.text}
            </Text>
          );
        }
        if (part.type === 'link') {
          return (
            <Text
              key={index}
              onPress={() => handleLinkPress(part.url)}
              style={[
                styles.body,
                styles.link,
                { color: colors.primary.main },
              ]}
              accessibilityRole="link"
            >
              {part.text}
            </Text>
          );
        }
        return (
          <Text key={index} style={[styles.body, { color }]}>
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function AssistantMarkdownText({
  content,
  color,
  style,
  containerStyle,
  onLinkPress,
}: Props) {
  const blocks = parseAssistantMarkdown(content);
  return (
    <View style={containerStyle}>
      {blocks.map((block, index) => {
        if (block.type === 'bullet') {
          return (
            <View key={index} style={styles.bulletRow}>
              <Text style={[styles.body, styles.bulletMark, { color }]}>•</Text>
              <View style={styles.bulletBody}>
                <InlineRuns inlines={block.inlines} color={color} style={style} onLinkPress={onLinkPress} />
              </View>
            </View>
          );
        }
        return (
          <View
            key={index}
            style={index > 0 ? styles.paragraphGap : undefined}
          >
            <InlineRuns inlines={block.inlines} color={color} style={style} onLinkPress={onLinkPress} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  link: {
    textDecorationLine: 'underline',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  bulletMark: {
    width: 16,
    fontWeight: '700',
  },
  bulletBody: {
    flex: 1,
    minWidth: 0,
  },
  paragraphGap: {
    marginTop: 8,
  },
});
