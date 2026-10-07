import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
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
};

function InlineRuns({
  inlines,
  color,
  style,
}: {
  inlines: AssistantMdInline[];
  color: string;
  style?: TextStyle;
}) {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const handleLinkPress = useCallback((url: string) => {
    trackSiteEvent({
      eventType: 'assistant.deeplink.tap',
      metadata: { url },
    });

    // Try in-app navigation for known routes
    const itemMatch = url.match(/\/items\/([^/?]+)/);
    if (itemMatch) {
      const inventoryId = itemMatch[1];
      navigation.navigate('ItemDetail', { itemId: inventoryId });
      return;
    }

    const orderMatch = url.match(/\/orders\/([^/?]+)\/reorder/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      navigation.navigate('OrderDetail', { orderId });
      return;
    }

    // Fall back to external browser
    void Linking.openURL(url);
  }, [navigation]);

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
                <InlineRuns inlines={block.inlines} color={color} style={style} />
              </View>
            </View>
          );
        }
        return (
          <View
            key={index}
            style={index > 0 ? styles.paragraphGap : undefined}
          >
            <InlineRuns inlines={block.inlines} color={color} style={style} />
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
