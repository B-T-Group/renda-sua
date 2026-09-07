import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const SECTIONS: { titleKey: string; contentKey: string }[] = [
  { titleKey: 'legal.terms.acceptance', contentKey: 'legal.terms.acceptanceText' },
  { titleKey: 'legal.terms.userAccounts', contentKey: 'legal.terms.accountsText' },
  { titleKey: 'legal.terms.deliveryAgents', contentKey: 'legal.terms.deliveryAgentsText' },
  { titleKey: 'legal.terms.ordersAndPayments', contentKey: 'legal.terms.ordersText' },
  { titleKey: 'legal.terms.prohibitedUses', contentKey: 'legal.terms.prohibitedText' },
  { titleKey: 'legal.terms.limitationOfLiability', contentKey: 'legal.terms.liabilityText' },
  { titleKey: 'legal.terms.termination', contentKey: 'legal.terms.terminationText' },
  { titleKey: 'legal.terms.changes', contentKey: 'legal.terms.changesText' },
  { titleKey: 'legal.terms.governingLaw', contentKey: 'legal.terms.governingLawText' },
  { titleKey: 'legal.terms.contact', contentKey: 'legal.terms.contactText' },
];

export default function TermsScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text.primary }, typography.h5 as any]}>
        {t('legal.terms.title')}
      </Text>
      <Text style={[styles.updated, { color: colors.text.secondary }, typography.caption as any]}>
        {t('legal.terms.lastUpdated')}
      </Text>

      {SECTIONS.map(({ titleKey, contentKey }) => (
        <View key={titleKey} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as any]}>
            {t(titleKey)}
          </Text>
          <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as any]}>
            {t(contentKey)}
          </Text>
        </View>
      ))}

      <View style={[styles.contactBox, { backgroundColor: colors.surface, borderRadius: 8, borderColor: colors.divider }]}>
        <Text style={[styles.contactLabel, { color: colors.text.secondary }, typography.caption as any]}>
          {t('legal.terms.email')}
        </Text>
        <Text style={[styles.contactValue, { color: colors.primary.main }, typography.body2 as any]}>
          {t('legal.terms.emailAddress')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { marginBottom: 4 },
  updated: { marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { marginBottom: 8, fontWeight: '600' },
  sectionBody: { lineHeight: 22 },
  contactBox: { marginTop: 8, padding: 16, borderWidth: 1 },
  contactLabel: { marginBottom: 4 },
  contactValue: {},
});
