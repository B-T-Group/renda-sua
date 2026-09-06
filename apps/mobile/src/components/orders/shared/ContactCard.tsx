import { Linking, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';

export interface ContactInfo {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  subtitle?: string | null;
}

export interface ContactCardProps {
  title: string;
  contact?: ContactInfo | null;
  emptyLabel?: string;
}

export function ContactCard({ title, contact, emptyLabel }: ContactCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const empty =
    !contact?.name && !contact?.phone && !contact?.email;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.xs,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ fontWeight: '700' }}>
        {title}
      </Text>
      {empty ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {emptyLabel ??
            t('orders.contact.unavailable', 'Contact unavailable')}
        </Text>
      ) : (
        <>
          {contact?.name ? (
            <View style={[styles.row, { gap: spacing.xs }]}>
              <MaterialCommunityIcons
                name="account"
                size={16}
                color={colors.text.secondary}
              />
              <Text variant="bodyMedium" style={{ fontWeight: '600', flex: 1 }}>
                {contact.name}
              </Text>
            </View>
          ) : null}
          {contact?.subtitle ? (
            <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
              {contact.subtitle}
            </Text>
          ) : null}
          {contact?.phone ? (
            <Text
              variant="bodyMedium"
              style={{ color: colors.primary.main }}
              onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
            >
              {contact.phone}
            </Text>
          ) : null}
          {contact?.email ? (
            <Text
              variant="bodyMedium"
              style={{ color: colors.primary.main }}
              onPress={() => void Linking.openURL(`mailto:${contact.email}`)}
            >
              {contact.email}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
