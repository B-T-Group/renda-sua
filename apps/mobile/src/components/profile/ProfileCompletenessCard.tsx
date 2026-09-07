import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AddProfileEmailDialog } from '../dialogs/AddProfileEmailDialog';
import { AddProfilePhoneDialog } from '../dialogs/AddProfilePhoneDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { MeUser } from '../../types/me';

interface ContactRowProps {
  icon: 'email-outline' | 'phone-outline';
  label: string;
  present: boolean;
  addLabel: string;
  onAdd: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}

function ContactRow({
  icon,
  label,
  present,
  addLabel,
  onAdd,
  colors,
  spacing,
}: ContactRowProps) {
  return (
    <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
      <View style={styles.row}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: present
                ? colors.success.main + '20'
                : colors.warning.main + '20',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={present ? colors.success.dark : colors.warning.dark}
          />
        </View>
        <Text
          variant="bodyMedium"
          style={[styles.label, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {present ? (
          <MaterialCommunityIcons
            name="check-circle"
            size={22}
            color={colors.success.main}
          />
        ) : null}
      </View>
      {!present ? (
        <Button
          mode="outlined"
          onPress={onAdd}
          style={{ borderColor: colors.primary.main, alignSelf: 'stretch' }}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {addLabel}
        </Button>
      ) : null}
    </View>
  );
}

export interface ProfileCompletenessCardProps {
  me: MeUser;
  onRefresh: () => void;
}

export function ProfileCompletenessCard({
  me,
  onRefresh,
}: ProfileCompletenessCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [emailDialogVisible, setEmailDialogVisible] = useState(false);
  const [phoneDialogVisible, setPhoneDialogVisible] = useState(false);

  const hasEmail = Boolean(me.email?.trim());
  const hasPhone = Boolean(me.phone_number?.trim());

  if (hasEmail && hasPhone) return null;

  return (
    <>
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.warning.light + '80',
            marginBottom: spacing.md,
            padding: spacing.md,
          },
        ]}
      >
        <View style={[styles.headerRow, { marginBottom: spacing.sm }]}>
          <MaterialCommunityIcons
            name="account-check-outline"
            size={20}
            color={colors.warning.dark}
          />
          <Text
            variant="titleSmall"
            style={{
              color: colors.warning.dark,
              marginLeft: 8,
              fontWeight: '700',
              flex: 1,
              minWidth: 0,
            }}
          >
            {t('nudge.profile.completenessTitle', 'Complete your profile')}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
        >
          {t(
            'nudge.profile.completenessSubtitle',
            'Add the missing contact info to stay reachable.'
          )}
        </Text>

        <ContactRow
          icon="email-outline"
          label={t('profile.email', 'Email')}
          present={hasEmail}
          addLabel={t('nudge.contact.addEmail', 'Add email')}
          onAdd={() => setEmailDialogVisible(true)}
          colors={colors}
          spacing={spacing}
        />

        {!hasEmail && !hasPhone ? <Divider /> : null}

        <ContactRow
          icon="phone-outline"
          label={t('profile.phoneNumber', 'Phone number')}
          present={hasPhone}
          addLabel={t('nudge.contact.addPhone', 'Add phone number')}
          onAdd={() => setPhoneDialogVisible(true)}
          colors={colors}
          spacing={spacing}
        />
      </View>

      <AddProfileEmailDialog
        visible={emailDialogVisible}
        onDismiss={() => setEmailDialogVisible(false)}
        onSaved={() => {
          setEmailDialogVisible(false);
          onRefresh();
        }}
      />
      <AddProfilePhoneDialog
        visible={phoneDialogVisible}
        defaultCountry={me.country}
        onDismiss={() => setPhoneDialogVisible(false)}
        onSaved={() => {
          setPhoneDialogVisible(false);
          onRefresh();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {},
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  ctaContent: {
    minHeight: 44,
  },
  ctaLabel: {
    fontSize: 13,
    marginVertical: 0,
  },
});
