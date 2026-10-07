import React, { useCallback, useEffect, useRef } from 'react';
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
import { trackDeeplinkShown, trackDeeplinkTap, type LauncherEventContext } from '@/services/analytics/assistantLauncherAnalytics';

type Nav = NativeStackNavigationProp<ClientRootStackParamList>;

type Props = {
  content: string;
  color: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  /** Optional handler for special link patterns (e.g., reorder links) */
  onLinkPress?: (url: string) => boolean;
  /** Analytics context for tracking deeplinks */
  analyticsCtx?: LauncherEventContext;
};

type DeeplinkMetadata = {
  type: 'item' | 'store' | 'cart' | 'reorder' | 'order' | 'search';
  targetId?: string;
};

/**
 * Parse a URL to extract deeplink metadata for analytics.
 * Returns null if the URL doesn't match any known pattern.
 */
function parseDeeplinkUrl(url: string): DeeplinkMetadata | null {
  // /items/:id
  const itemMatch = url.match(/\/items\/([0-9a-f-]{36})/i);
  if (itemMatch) return { type: 'item', targetId: itemMatch[1] };
  
  // /store/:id
  const storeMatch = url.match(/\/store\/([0-9a-f-]{36})/i);
  if (storeMatch) return { type: 'store', targetId: storeMatch[1] };
  
  // /cart
  if (url.includes('/cart')) return { type: 'cart' };
  
  // /orders/:id/reorder
  const reorderMatch = url.match(/\/orders\/([0-9a-f-]{36})\/reorder/i);
  if (reorderMatch) return { type: 'reorder', targetId: reorderMatch[1] };
  
  // /orders/:id
  const orderMatch = url.match(/\/orders\/([0-9a-f-]{36})/i);
  if (orderMatch) return { type: 'order', targetId: orderMatch[1] };
  
  // /shop?q=...
  if (url.includes('/shop')) return { type: 'search' };
  
  return null;
}

function InlineRuns({
  inlines,
  color,
  style,
  onLinkPress,
  analyticsCtx,
}: {
  inlines: AssistantMdInline[];
  color: string;
  style?: TextStyle;
  onLinkPress?: (url: string) => boolean;
  analyticsCtx?: LauncherEventContext;
}) {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const shownLinksRef = useRef(new Set<string>());

  // Track deeplink.shown when links are rendered (once per URL)
  useEffect(() => {
    if (!analyticsCtx) return;
    inlines.forEach((part, index) => {
      if (part.type === 'link') {
        const key = `${part.url}:${index}`;
        if (shownLinksRef.current.has(key)) return;
        shownLinksRef.current.add(key);
        
        const metadata = parseDeeplinkUrl(part.url);
        if (metadata) {
          trackDeeplinkShown(analyticsCtx, metadata.type, index, metadata.targetId);
        }
      }
    });
  }, [inlines, analyticsCtx]);

  const handleLinkPress = useCallback((url: string) => {
    // Track deeplink.tap with allowlisted metadata
    if (analyticsCtx) {
      const metadata = parseDeeplinkUrl(url);
      if (metadata) {
        trackDeeplinkTap(analyticsCtx, metadata.type, metadata.targetId);
      }
    }

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
  }, [navigation, onLinkPress, analyticsCtx]);

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
  analyticsCtx,
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
                <InlineRuns 
                  inlines={block.inlines} 
                  color={color} 
                  style={style} 
                  onLinkPress={onLinkPress}
                  analyticsCtx={analyticsCtx}
                />
              </View>
            </View>
          );
        }
        return (
          <View
            key={index}
            style={index > 0 ? styles.paragraphGap : undefined}
          >
            <InlineRuns 
              inlines={block.inlines} 
              color={color} 
              style={style} 
              onLinkPress={onLinkPress}
              analyticsCtx={analyticsCtx}
            />
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
