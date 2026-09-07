import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const COLLECT_SECTIONS: { titleKey: string; contentKey: string }[] = [
  { titleKey: 'legal.privacy.personalInformation', contentKey: 'legal.privacy.personalInfoText' },
  { titleKey: 'legal.privacy.locationInformation', contentKey: 'legal.privacy.locationInfoText' },
  { titleKey: 'legal.privacy.usageInformation', contentKey: 'legal.privacy.usageInfoText' },
];

const USE_KEYS = [
  'legal.privacy.use1',
  'legal.privacy.use2',
  'legal.privacy.use3',
  'legal.privacy.use4',
  'legal.privacy.use5',
  'legal.privacy.use6',
] as const;

const SHARE_KEYS = [
  'legal.privacy.share1',
  'legal.privacy.share2',
  'legal.privacy.share3',
  'legal.privacy.share4',
] as const;

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text.primary }, typography.h5 as object]}>
        {t('legal.privacy.title', 'Privacy Policy')}
      </Text>
      <Text style={[styles.updated, { color: colors.text.secondary }, typography.caption as object]}>
        {t('legal.privacy.lastUpdated', 'Last updated: May 2026')}
      </Text>

      <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as object]}>
        {t('legal.privacy.intro')}
      </Text>

      <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object, styles.section]}>
        {t('legal.privacy.informationWeCollect', 'Information We Collect')}
      </Text>

      {COLLECT_SECTIONS.map(({ titleKey, contentKey }) => (
        <View key={titleKey} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object]}>
            {t(titleKey)}
          </Text>
          <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as object]}>
            {t(contentKey)}
          </Text>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object]}>
          {t('legal.privacy.howWeUseInformation', 'How We Use Your Information')}
        </Text>
        {USE_KEYS.map((key) => (
          <Text key={key} style={[styles.bullet, { color: colors.text.primary }, typography.body2 as object]}>
            • {t(key)}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object]}>
          {t('legal.privacy.informationSharing', 'Information Sharing')}
        </Text>
        <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as object]}>
          {t('legal.privacy.sharingText')}
        </Text>
        {SHARE_KEYS.map((key) => (
          <Text key={key} style={[styles.bullet, { color: colors.text.primary }, typography.body2 as object]}>
            • {t(key)}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object]}>
          {t('legal.privacy.dataSecurity', 'Data Security')}
        </Text>
        <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as object]}>
          {t('legal.privacy.securityText')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object]}>
          {t('legal.privacy.yourRights', 'Your Rights')}
        </Text>
        <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as object]}>
          {t('legal.privacy.rightsText')}
        </Text>
      </View>

      <View style={[styles.contactBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary.main }, typography.subtitle1 as object]}>
          {t('legal.privacy.contact', 'Contact Us')}
        </Text>
        <Text style={[styles.sectionBody, { color: colors.text.primary }, typography.body2 as object]}>
          {t('legal.privacy.contactText')}
        </Text>
        <Text style={[styles.contactLabel, { color: colors.text.secondary }, typography.caption as object]}>
          {t('legal.privacy.email', 'Email')}
        </Text>
        <Text style={[styles.contactValue, { color: colors.primary.main }, typography.body2 as object]}>
          {t('legal.privacy.emailAddress', 'privacy@rendasua.com')}
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
  bullet: { lineHeight: 22, marginTop: 4, paddingLeft: 4 },
  contactBox: { marginTop: 8, padding: 16, borderWidth: 1, borderRadius: 8 },
  contactLabel: { marginTop: 12, marginBottom: 4 },
  contactValue: {},
});
