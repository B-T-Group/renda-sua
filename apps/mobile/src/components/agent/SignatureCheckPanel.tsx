import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme';
import {
  signatureStatusKey,
  TERMINAL_SIGNATURE_STATUSES,
  type SignatureCheckResult,
} from '../../utils/waitForAgentSignature';

/** "Checking document signature": spinner while polling, then the real status + next actions. */
export function SignatureCheckPanel(props: {
  result: SignatureCheckResult | null;
  busy: boolean;
  onCheckAgain: () => void;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const key = signatureStatusKey(props.result?.status);
  const terminal = TERMINAL_SIGNATURE_STATUSES.includes(key);
  return (
    <View style={styles.box}>
      <Text variant="titleMedium">{t('agentContract.checkTitle', 'Checking document signature')}</Text>
      {!props.result ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text variant="bodyMedium" style={styles.flex}>
            {t('agentContract.checkBody', 'Waiting for BoldSign to confirm your signature. This can take up to a minute.')}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="bodyMedium" style={{ color: terminal ? colors.error.main : undefined }}>
            {t('agentContract.checkResult', 'Your document is not signed yet. Current status: {{status}}.', {
              status: t(`agentContract.state.${key}`, key),
            })}
          </Text>
          <Text variant="bodySmall">
            {t('agentContract.resumeHint', 'Open the BoldSign email to finish signing, or we can email you the link again.')}
          </Text>
          <Button mode="contained" disabled={props.busy} onPress={props.onCheckAgain}>
            {t('agentContract.checkAgain', 'Check again')}
          </Button>
          <Button mode="outlined" disabled={props.busy} onPress={props.onResume}>
            {t('agentContract.resume', 'Resume signing')}
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
