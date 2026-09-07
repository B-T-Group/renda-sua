import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

type FAQItem = { id: string; qKey: string; aKey: string };

const FAQ_ITEMS: FAQItem[] = [
  { id: 'hold', qKey: 'legal.faq.agent.hold.q', aKey: 'legal.faq.agent.hold.a' },
  { id: 'verifiedLessHold', qKey: 'legal.faq.agent.verifiedLessHold.q', aKey: 'legal.faq.agent.verifiedLessHold.a' },
  { id: 'release', qKey: 'legal.faq.settlement.release.q', aKey: 'legal.faq.settlement.release.a' },
  { id: 'failedDeliveries', qKey: 'legal.faq.failedDeliveries.q', aKey: 'legal.faq.failedDeliveries.a' },
  { id: 'howToClaim', qKey: 'legal.faq.howToClaim.q', aKey: 'legal.faq.howToClaim.a' },
  { id: 'whenPaid', qKey: 'legal.faq.whenPaid.q', aKey: 'legal.faq.whenPaid.a' },
];

function FAQRow({
  item,
  expanded,
  onPress,
  colors,
  typography,
  t,
}: {
  item: FAQItem;
  expanded: boolean;
  onPress: () => void;
  colors: { background: { paper: string }; text: { primary: string; secondary: string }; divider: string };
  typography: Record<string, unknown>;
  t: (key: string) => string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
      <Pressable
        onPress={onPress}
        style={styles.cardHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(item.qKey)}
      >
        <Text style={[styles.question, { color: colors.text.primary }, typography.subtitle2 as any]} numberOfLines={expanded ? 0 : 2}>
          {t(item.qKey)}
        </Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.text.secondary}
          style={styles.chevron}
        />
      </Pressable>
      {expanded && (
        <View style={styles.answerWrap}>
          <Text style={[styles.answer, { color: colors.text.secondary }, typography.body2 as any]}>
            {t(item.aKey)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function FAQScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text.primary }, typography.h5 as any]}>
        {t('legal.faq.title')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }, typography.body2 as any]}>
        {t('legal.faq.subtitle')}
      </Text>

      {FAQ_ITEMS.map((item) => (
        <FAQRow
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          onPress={() => toggle(item.id)}
          colors={colors}
          typography={typography}
          t={t}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 24 },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  question: { flex: 1, fontWeight: '600' },
  chevron: { marginLeft: 8 },
  answerWrap: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 },
  answer: { lineHeight: 22 },
});
