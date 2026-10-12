import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentAgreementIllustration } from '../../components/illustrations/AgentAgreementIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import {
  agentContractApi,
  type AgentContractStatus,
} from '../../services/agentContractApi';
import { spacing } from '../../theme';

export default function AgentAgreementScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [status, setStatus] = useState<AgentContractStatus | null>(null);
  const [nationality, setNationality] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await agentContractApi.status();
      setStatus(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('agentContract.loadError', 'Could not load the agreement.'));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const send = () => {
    void run(() =>
      agentContractApi.ensure({
        nationality: nationality.trim() || undefined,
        idNumber: idNumber.trim() || undefined,
      })
    );
  };

  const run = async (call: () => Promise<{ data: AgentContractStatus }>) => {
    setLoading(true);
    try {
      const res = await call();
      setStatus(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('agentContract.loadError', 'Could not load the agreement.'));
    } finally {
      setLoading(false);
    }
  };

  const waiting = status?.status === 'sent' || status?.status === 'viewed';

  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        { backgroundColor: colors.pageBackground, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <AgentAgreementIllustration label={t('agentContract.illustration', 'Agent agreement')} />
      <Text variant="headlineSmall">{t('agentContract.title', 'Sign your agent agreement')}</Text>
      <Text variant="bodyMedium">
        {t(
          'agentContract.body',
          'We email the agreement for your region and language. Claim deliveries after you sign it.'
        )}
      </Text>
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      {status?.signed ? (
        <Button mode="contained" onPress={() => navigation.goBack()}>
          {t('agentContract.back', 'Return to dashboard')}
        </Button>
      ) : (
        <AgreementForm
          status={status}
          waiting={waiting}
          loading={loading}
          nationality={nationality}
          idNumber={idNumber}
          onNationality={setNationality}
          onIdNumber={setIdNumber}
          onSend={send}
          onResend={() => void run(() => agentContractApi.resend())}
          onRefresh={() => void run(() => agentContractApi.refresh())}
        />
      )}
    </ScrollView>
  );
}

function AgreementForm(props: {
  status: AgentContractStatus | null;
  waiting: boolean;
  loading: boolean;
  nationality: string;
  idNumber: string;
  onNationality: (value: string) => void;
  onIdNumber: (value: string) => void;
  onSend: () => void;
  onResend: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const blocked = !canSend(props.status, props.nationality, props.idNumber);
  return (
    <View style={styles.form}>
      {props.status?.missingEmail || props.status?.missingPhone ? (
        <Text>
          {t('agentContract.contact', 'Add your email and phone on your profile before we can send the agreement.')}
        </Text>
      ) : null}
      {props.waiting ? (
        <Text>
          {t('agentContract.emailed', 'Check {{email}} for the BoldSign email, then refresh.', {
            email: props.status?.signerEmail || t('agentContract.yourEmail', 'your email'),
          })}
        </Text>
      ) : null}
      {props.status?.needsNationality ? (
        <TextInput
          mode="outlined"
          label={t('agentContract.nationality', 'Nationality')}
          value={props.nationality}
          onChangeText={props.onNationality}
        />
      ) : null}
      {props.status?.needsIdNumber ? (
        <TextInput
          mode="outlined"
          label={t('agentContract.idNumber', 'ID number')}
          value={props.idNumber}
          onChangeText={props.onIdNumber}
        />
      ) : null}
      {props.waiting ? (
        <Button mode="contained" loading={props.loading} onPress={props.onRefresh}>
          {t('agentContract.refresh', 'I have signed')}
        </Button>
      ) : (
        <Button mode="contained" disabled={blocked || props.loading} onPress={props.onSend}>
          {t('agentContract.send', 'Email me the agreement')}
        </Button>
      )}
      {props.waiting ? (
        <Button mode="text" disabled={props.loading} onPress={props.onResend}>
          {t('agentContract.resend', 'Resend email')}
        </Button>
      ) : null}
    </View>
  );
}

function canSend(
  status: AgentContractStatus | null,
  nationality: string,
  idNumber: string
): boolean {
  if (!status || status.missingEmail || status.missingPhone) return false;
  if (status.needsNationality && !nationality.trim()) return false;
  if (status.needsIdNumber && !idNumber.trim()) return false;
  return true;
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md },
  form: { gap: spacing.md, width: '100%' },
});
