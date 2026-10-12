import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentAgreementIllustration } from '../../components/illustrations/AgentAgreementIllustration';
import { SearchablePickerModal, type PickerRow } from '../../components/forms/SearchablePickerModal';
import { useTheme } from '../../contexts/ThemeContext';
import { filterSignupEnabledCountries, useSupportedCountries } from '../../hooks/useSupportedCountries';
import { useLanguage } from '../../hooks/useLanguage';
import { useProfileMe } from '../../hooks/useProfileMe';
import {
  agentContractApi,
  type AgentContractStatus,
} from '../../services/agentContractApi';
import { agentApi } from '../../services/agentApi';
import { spacing } from '../../theme';

export default function AgentAgreementScreen({ onEntered }: { onEntered?: () => void }) {
  const { t, i18n } = useTranslation();
  const { changeLanguage } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [status, setStatus] = useState<AgentContractStatus | null>(null);
  const [nationality, setNationality] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [language, setLanguage] = useState<'en' | 'fr' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notSignedYet, setNotSignedYet] = useState(false);

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

  const refresh = () => {
    setNotSignedYet(false);
    void run(async () => {
      const res = await agentContractApi.refresh();
      if (res.data.signed) onEntered?.();
      else setNotSignedYet(true);
      return res;
    });
  };

  const contractLanguage = chosenLanguage(language, status, i18n.language);
  const needs = fieldNeeds(status, contractLanguage);
  const waiting = status?.status === 'sent' || status?.status === 'viewed';

  useEffect(() => {
    if (appLocale(i18n.language) === contractLanguage) return;
    void changeLanguage(contractLanguage);
  }, [changeLanguage, contractLanguage, i18n.language]);

  const selectLanguage = (next: 'en' | 'fr') => {
    setLanguage(next);
    void savePreferredLanguage(next);
  };

  const send = () => {
    setNotSignedYet(false);
    void run(() =>
      agentContractApi.ensure({
        language: contractLanguage,
        nationality: needs.needsNationality ? nationality.trim() || undefined : undefined,
        idNumber: needs.needsIdNumber ? idNumber.trim() || undefined : undefined,
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
          'Read and sign your agent agreement. You can then claim deliveries and earn commissions.'
        )}
      </Text>
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      {status?.signed ? (
        <Button mode="contained" onPress={() => (onEntered ? onEntered() : navigation.goBack())}>
          {t('agentContract.back', 'Return to dashboard')}
        </Button>
      ) : (
        <AgreementForm
          status={status}
          waiting={waiting}
          loading={loading}
          notSignedYet={notSignedYet}
          nationality={nationality}
          idNumber={idNumber}
          language={contractLanguage}
          needsNationality={needs.needsNationality}
          needsIdNumber={needs.needsIdNumber}
          onNationality={setNationality}
          onIdNumber={setIdNumber}
          onLanguage={selectLanguage}
          onSend={send}
          onResend={() => void run(() => agentContractApi.resend())}
          onRefresh={refresh}
          onProfile={() => navigation.navigate('Profile')}
        />
      )}
    </ScrollView>
  );
}

function AgreementForm(props: {
  status: AgentContractStatus | null;
  waiting: boolean;
  loading: boolean;
  notSignedYet: boolean;
  nationality: string;
  idNumber: string;
  language: 'en' | 'fr';
  needsNationality: boolean;
  needsIdNumber: boolean;
  onNationality: (value: string) => void;
  onIdNumber: (value: string) => void;
  onLanguage: (value: 'en' | 'fr') => void;
  onSend: () => void;
  onResend: () => void;
  onRefresh: () => void;
  onProfile: () => void;
}) {
  const { t } = useTranslation();
  const blocked = !canSend(props.status, props.nationality, props.idNumber, props);
  return (
    <View style={styles.form}>
      {props.status?.missingEmail || props.status?.missingPhone ? (
        <>
          <Text>
            {t('agentContract.contact', 'Add your email and phone on your profile before we can send the agreement.')}
          </Text>
          <Button mode="outlined" onPress={() => props.onProfile()}>
            {t('agentContract.updateProfile', 'Update profile')}
          </Button>
        </>
      ) : null}
      {props.status?.signerEmail ? (
        <Text>
          {t('agentContract.sendTo', 'We will send the agreement to {{email}}.', {
            email: props.status.signerEmail,
          })}
        </Text>
      ) : null}
      {props.waiting ? (
        <Text>
          {t('agentContract.emailed', 'Check {{email}} for the BoldSign email, then refresh.', {
            email: props.status?.signerEmail || t('agentContract.yourEmail', 'your email'),
          })}
        </Text>
      ) : null}
      {props.notSignedYet ? (
        <Text>
          {t(
            'agentContract.notSignedYet',
            'We have not received your signature yet. Sign the BoldSign email, then try again.'
          )}
        </Text>
      ) : null}
      {props.waiting ? null : (
        <LanguageSelect value={props.language} onChange={props.onLanguage} />
      )}
      {props.needsNationality ? (
        <NationalitySelect value={props.nationality} onChange={props.onNationality} />
      ) : null}
      {props.needsIdNumber ? (
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

function NationalitySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { me } = useProfileMe();
  const { countries, loading } = useSupportedCountries();
  const [open, setOpen] = useState(false);
  const options = filterSignupEnabledCountries(countries);
  const rows: PickerRow[] = options.map((country) => ({
    id: country.name || country.code,
    title: country.name || country.code,
  }));
  useEffect(() => {
    if (value) return;
    const match = countryMatch(options, me?.country);
    if (match) onChange(match);
  }, [me?.country, onChange, options, value]);
  return (
    <>
      <Button mode="outlined" loading={loading} onPress={() => setOpen(true)}>
        {value || t('agentContract.nationality', 'Nationality')}
      </Button>
      <SearchablePickerModal
        visible={open}
        title={t('agentContract.nationality', 'Nationality')}
        rows={rows}
        searchPlaceholder={t('addresses.pickerSearch', 'Search…')}
        onDismiss={() => setOpen(false)}
        onSelect={(row) => {
          onChange(row.id);
          setOpen(false);
        }}
      />
    </>
  );
}

function LanguageSelect({
  value,
  onChange,
}: {
  value: 'en' | 'fr';
  onChange: (value: 'en' | 'fr') => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text variant="labelLarge">{t('agentContract.language', 'Contract language')}</Text>
      <SegmentedButtons
        value={value}
        onValueChange={(next) => onChange(next as 'en' | 'fr')}
        buttons={[
          { value: 'en', label: t('agentContract.languageEn', 'English') },
          { value: 'fr', label: t('agentContract.languageFr', 'French') },
        ]}
      />
    </>
  );
}

function canSend(
  status: AgentContractStatus | null,
  nationality: string,
  idNumber: string,
  needs: { needsNationality: boolean; needsIdNumber: boolean }
): boolean {
  if (!status || status.missingEmail || status.missingPhone) return false;
  if (needs.needsNationality && !nationality.trim()) return false;
  if (needs.needsIdNumber && !idNumber.trim()) return false;
  return true;
}

function appLocale(language?: string | null): 'en' | 'fr' {
  return (language ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

async function savePreferredLanguage(language: 'en' | 'fr') {
  try {
    const me = await agentApi.users.getMe();
    const user = me.user;
    if (!user || appLocale(user.preferred_language) === language) return;
    await agentApi.users.updateMe({
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      preferredLanguage: language,
    });
  } catch {
    // The screen language already switched.
  }
}

function chosenLanguage(
  picked: 'en' | 'fr' | null,
  status: AgentContractStatus | null,
  appLanguage: string
): 'en' | 'fr' {
  if (picked) return picked;
  if (status?.language) return status.language;
  return appLocale(appLanguage);
}

function fieldNeeds(status: AgentContractStatus | null, language: 'en' | 'fr') {
  return status?.byLanguage?.[language] ?? {
    needsNationality: Boolean(status?.needsNationality),
    needsIdNumber: Boolean(status?.needsIdNumber),
  };
}

function countryMatch(
  options: Array<{ code: string; name: string }>,
  country?: string | null
): string | null {
  const code = country?.trim().toUpperCase();
  const match = options.find((option) => option.code.toUpperCase() === code);
  return match ? match.name || match.code : null;
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md },
  form: { gap: spacing.md, width: '100%' },
});
