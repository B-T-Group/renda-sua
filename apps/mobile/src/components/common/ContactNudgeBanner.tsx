import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NoticeBanner } from './NoticeBanner';
import { AddProfileEmailDialog } from '../dialogs/AddProfileEmailDialog';
import { AddProfilePhoneDialog } from '../dialogs/AddProfilePhoneDialog';
import { useTheme } from '../../contexts/ThemeContext';

export interface ContactNudgeBannerProps {
  missingField: 'email' | 'phone';
  onDismiss: () => void;
  onSaved?: () => void;
}

export const ContactNudgeBanner = observer(function ContactNudgeBanner({
  missingField,
  onDismiss,
  onSaved,
}: ContactNudgeBannerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [dialogVisible, setDialogVisible] = useState(false);

  const isEmail = missingField === 'email';

  const title = isEmail
    ? t('nudge.contact.emailTitle', 'Add your email')
    : t('nudge.contact.phoneTitle', 'Add your phone number');

  const benefit = isEmail
    ? t('nudge.contact.emailBenefit', 'Get order receipts and updates sent directly to your inbox.')
    : t('nudge.contact.phoneBenefit', 'We can reach you directly for delivery updates.');

  const addLabel = isEmail
    ? t('nudge.contact.addEmail', 'Add email')
    : t('nudge.contact.addPhone', 'Add phone number');

  return (
    <>
      <NoticeBanner
        tone="info"
        icon={isEmail ? 'email-plus-outline' : 'phone-plus-outline'}
        title={title}
        message={benefit}
      >
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => setDialogVisible(true)}
            buttonColor={colors.info.dark}
            textColor={colors.onDark}
            style={styles.addBtn}
          >
            {addLabel}
          </Button>
          <Button
            mode="text"
            onPress={onDismiss}
            textColor={colors.text.secondary}
            style={styles.dismissBtn}
            icon={() => (
              <MaterialCommunityIcons name="close" size={16} color={colors.text.secondary} />
            )}
          >
            {t('nudge.contact.dismiss', 'Maybe later')}
          </Button>
        </View>
      </NoticeBanner>

      {isEmail ? (
        <AddProfileEmailDialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          onSaved={() => {
            setDialogVisible(false);
            onSaved?.();
          }}
        />
      ) : (
        <AddProfilePhoneDialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          onSaved={() => {
            setDialogVisible(false);
            onSaved?.();
          }}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  addBtn: { alignSelf: 'flex-start' },
  dismissBtn: { alignSelf: 'flex-start' },
});
