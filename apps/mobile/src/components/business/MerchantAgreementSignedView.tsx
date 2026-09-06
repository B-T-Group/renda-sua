import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { AgreementSignedIllustration } from '../illustrations/AgreementSignedIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/apiClient';
import type { MerchantContractStatus } from '../../services/businessVerificationApi';
import { fetchUploadViewUrl } from '../../services/uploadsApi';
import type { BackendUserDocument } from '../../hooks/useBackendDocuments';

const CONTRACT_DOC_TYPE = 'rendasua_contract_agreement';

type Props = {
  contract?: MerchantContractStatus | null;
  onBackToDashboard: () => void;
};

/** Shown when the merchant already has a signed partnership agreement. */
export function MerchantAgreementSignedView({
  contract,
  onBackToDashboard,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSignedContract = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const url = await resolveSignedContractUrl(contract);
      if (!url) {
        setError(
          t(
            'business.contract.signedPdfMissing',
            'Signed contract not found in your documents yet.'
          )
        );
        return;
      }
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError(
        t('business.contract.openSignedFailed', 'Could not open the signed contract.')
      );
    } finally {
      setOpening(false);
    }
  }, [contract, t]);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <View style={styles.hero} accessibilityRole="image">
        <AgreementSignedIllustration />
      </View>
      <Text
        variant="headlineSmall"
        style={[styles.title, { color: colors.text.primary }]}
      >
        {t('business.contract.signedTitle', 'Merchant agreement signed')}
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.subtitle, { color: colors.text.secondary }]}
      >
        {t(
          'business.contract.signedBody',
          'Your partnership agreement is on file. Your store is active — return to the dashboard to keep selling. You can earn a Verified badge later.'
        )}
      </Text>
      {error ? (
        <Text variant="bodySmall" style={{ color: colors.error.main, marginBottom: 12 }}>
          {error}
        </Text>
      ) : null}
      <Button
        mode="contained"
        onPress={onBackToDashboard}
        style={styles.cta}
        contentStyle={styles.btnContent}
      >
        {t('business.setup.success.goToDashboard', 'Go to dashboard')}
      </Button>
      <Button
        mode="outlined"
        loading={opening}
        disabled={opening}
        onPress={() => void openSignedContract()}
        style={styles.secondary}
        contentStyle={styles.btnContent}
      >
        {t('business.contract.viewSigned', 'View signed contract')}
      </Button>
    </View>
  );
}

async function resolveSignedContractUrl(
  contract?: MerchantContractStatus | null
): Promise<string | null> {
  if (contract?.canDownload && contract.contractId) {
    return fetchBoldSignDownloadUrl(contract);
  }
  // BoldSign rail without a downloadable PDF yet — do not open a stale upload.
  if (contract?.boldSignEnabled) return null;
  const uploadId = await findLatestContractUploadId();
  if (!uploadId) return null;
  return fetchUploadViewUrl(uploadId);
}

async function fetchBoldSignDownloadUrl(
  contract?: MerchantContractStatus | null
): Promise<string | null> {
  if (!contract?.canDownload || !contract.contractId) return null;
  const res = await api.get<{ success: boolean; data: { url?: string } }>(
    `/business-contracts/${encodeURIComponent(contract.contractId)}/download`
  );
  return res.data?.url ?? null;
}

async function findLatestContractUploadId(): Promise<string | null> {
  const res = await api.get<{
    success: boolean;
    data: { uploads: BackendUserDocument[] };
  }>('/uploads/me');
  const uploads = res.data?.uploads ?? [];
  const matches = uploads.filter(
    (u) => u.document_type?.name === CONTRACT_DOC_TYPE
  );
  matches.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return matches[0]?.id ?? null;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 8 },
  title: { textAlign: 'center', fontWeight: '700', marginTop: 12 },
  subtitle: {
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 22,
  },
  cta: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  secondary: { marginTop: 8, width: '100%', maxWidth: 420, alignSelf: 'center' },
  btnContent: { minHeight: 48 },
});
