import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { AgreementHtmlEmbed } from '../../components/business/AgreementHtmlEmbed';
import { MerchantAgreementSignedView } from '../../components/business/MerchantAgreementSignedView';
import { MerchantAgreementSuccessView } from '../../components/business/MerchantAgreementSuccessView';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import { useKeyboardVerticalOffset } from '../../hooks/useKeyboardVerticalOffset';
import {
  businessVerificationApi,
  type MerchantContractStatus,
} from '../../services/businessVerificationApi';
import { buildMerchantAgreementDeviceInfo } from '../../utils/merchantAgreementDeviceInfo';
import {
  merchantAgreementPreviewVars,
  renderMerchantAgreementHtml,
} from '../../utils/renderMerchantAgreementHtml';
import type { BusinessRootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function BusinessMerchantAgreementScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardVerticalOffset();
  const navigation = useNavigation<Nav>();
  const { me } = useProfileMe();
  const [html, setHtml] = useState('');
  const [version, setVersion] = useState('');
  const [legalName, setLegalName] = useState('');
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [contract, setContract] = useState<MerchantContractStatus | null>(null);
  const [agreementComplete, setAgreementComplete] = useState(false);
  const agreementCompleteRef = useRef(false);
  const leftScreenRef = useRef(false);

  useEffect(() => {
    agreementCompleteRef.current = agreementComplete;
  }, [agreementComplete]);

  const defaultName = me ? `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() : '';

  useEffect(() => {
    if (defaultName && !legalName) setLegalName(defaultName);
  }, [defaultName, legalName]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await businessVerificationApi.getStatus();
      if (res.success) {
        setContract(res.data.contract ?? null);
        const signed =
          res.data.contract?.complete === true ||
          res.data.steps?.agreement?.complete === true;
        setAgreementComplete(signed);
      }
    } catch (e) {
      setSnackbar(
        e instanceof Error ? e.message : t('common.error', 'Error')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadAgreement = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const res = await businessVerificationApi.getMerchantAgreement();
      if (res.success) {
        const { html: raw, version: v, locale } = res.data;
        setVersion(v);
        setHasScrolledToEnd(false);
        const vars = merchantAgreementPreviewVars(me, v, locale ?? 'en');
        setHtml(renderMerchantAgreementHtml(raw, vars));
      }
    } catch (e) {
      setSnackbar(
        e instanceof Error ? e.message : t('business.verification.loadError', 'Could not load agreement')
      );
    } finally {
      setLoading(false);
    }
  }, [me, t]);

  useFocusEffect(
    useCallback(() => {
      // Only leave the post-sign success screen after a real navigate-away.
      if (leftScreenRef.current && agreementCompleteRef.current) {
        setDone(false);
      }
      void loadStatus();
      return () => {
        leftScreenRef.current = true;
      };
    }, [loadStatus])
  );

  useEffect(() => {
    if (contract && !contract.boldSignEnabled && !agreementComplete && !html) {
      void loadAgreement();
    }
  }, [contract, agreementComplete, loadAgreement, html]);

  const handleResend = useCallback(async () => {
    setBusy(true);
    try {
      await businessVerificationApi.resendContract();
      await loadStatus();
    } catch (e) {
      setSnackbar(
        e instanceof Error
          ? e.message
          : t('business.contract.resendFailed', 'Failed to resend contract')
      );
    } finally {
      setBusy(false);
    }
  }, [loadStatus, t]);

  const handleRefresh = useCallback(async () => {
    setBusy(true);
    try {
      await businessVerificationApi.refreshContract();
      await loadStatus();
    } catch (e) {
      setSnackbar(
        e instanceof Error ? e.message : t('common.error', 'Error')
      );
    } finally {
      setBusy(false);
    }
  }, [loadStatus, t]);

  const handleSubmit = useCallback(async () => {
    if (!hasScrolledToEnd || !legalName.trim() || !version) return;
    setBusy(true);
    try {
      await businessVerificationApi.acceptMerchantAgreement({
        legalName: legalName.trim(),
        agreementVersion: version,
        deviceInfo: buildMerchantAgreementDeviceInfo(),
      });
      setAgreementComplete(true);
      setDone(true);
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : t('common.error', 'Error'));
    } finally {
      setBusy(false);
    }
  }, [hasScrolledToEnd, legalName, version, t]);

  const goDashboard = useCallback(() => {
    navigation.navigate('BusinessMainTabs', { screen: 'BusinessDashboard' });
  }, [navigation]);

  if (loading && !contract && !done && !agreementComplete) {
    return (
      <View
        style={[
          styles.flex,
          {
            backgroundColor: colors.pageBackground,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  // Returning from Menu after a prior signature: view the signed PDF.
  if (agreementComplete && !done) {
    return (
      <MerchantAgreementSignedView
        contract={contract}
        onBackToDashboard={goDashboard}
      />
    );
  }

  if (contract?.boldSignEnabled) {
    if (contract.complete) {
      return (
        <MerchantAgreementSignedView
          contract={contract}
          onBackToDashboard={goDashboard}
        />
      );
    }

    const statusKey = contract.status ?? 'sent';
    const statusLabel = t(
      `business.contract.status.${statusKey}`,
      statusKey.replace('_', ' ')
    );

    return (
      <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
        <KeyboardAwareScrollView contentContainerStyle={styles.scroll}>
          <Text variant="headlineSmall" style={{ marginBottom: 12 }}>
            {t('business.contract.pendingTitle', 'Sign your merchant agreement')}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 16 }}>
            {t(
              'business.contract.pendingNotice',
              'We sent a secure signing link to your email via BoldSign. Open the email and sign electronically to continue.'
            )}
          </Text>
          <View style={[styles.statusCard, { borderColor: colors.divider }]}>
            <Text variant="labelMedium">{t('business.contract.statusLabel', 'Status')}</Text>
            <Text variant="titleMedium">{statusLabel}</Text>
          </View>
          <Button
            mode="contained"
            loading={busy}
            disabled={busy}
            onPress={() => void handleResend()}
            style={{ marginBottom: 8 }}
          >
            {t('business.contract.resend', 'Resend signing email')}
          </Button>
          <Button
            mode="outlined"
            loading={busy}
            disabled={busy}
            onPress={() => void handleRefresh()}
          >
            {t('common.refresh', 'Refresh')}
          </Button>
        </KeyboardAwareScrollView>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
          {snackbar}
        </Snackbar>
      </View>
    );
  }

  if (done) {
    return (
      <MerchantAgreementSuccessView onBackToDashboard={goDashboard} />
    );
  }

  const acceptHint = hasScrolledToEnd
    ? t(
        'business.verification.acceptBySigning',
        'By tapping Accept and sign, you agree to the Merchant Partnership Agreement.'
      )
    : t(
        'business.verification.scrollHint',
        'Please scroll to the end of the agreement before accepting.'
      );

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <View
        style={[
          styles.webWrap,
          {
            borderColor: colors.divider,
            marginHorizontal: spacing.md,
            marginTop: spacing.sm,
            backgroundColor: '#fff',
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : (
          <AgreementHtmlEmbed
            html={html}
            style={styles.webview}
            onScrolledToEnd={() => setHasScrolledToEnd(true)}
            onScrollReset={() => setHasScrolledToEnd(false)}
          />
        )}
        {!hasScrolledToEnd && !loading ? (
          <View pointerEvents="none" style={styles.scrollChipWrap}>
            <View
              style={[
                styles.scrollChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.divider,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                {t('business.verification.scrollForMore', 'Scroll for more')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
        style={[
          styles.footer,
          {
            borderTopColor: colors.divider,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            backgroundColor: colors.pageBackground,
          },
        ]}
      >
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.xs }}
        >
          {acceptHint}
        </Text>
        <TextInput
          label={t('business.verification.legalName', 'Full legal name')}
          value={legalName}
          onChangeText={setLegalName}
          mode="outlined"
          style={styles.field}
        />
        <Button
          mode="contained"
          loading={busy}
          disabled={busy || !hasScrolledToEnd || !legalName.trim() || loading}
          onPress={() => void handleSubmit()}
        >
          {busy
            ? t('business.verification.submitting', 'Submitting…')
            : t('business.verification.submit', 'Accept and sign')}
        </Button>
      </KeyboardAvoidingView>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  webWrap: {
    flex: 1,
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  webview: { flex: 1, backgroundColor: '#fff' },
  scrollChipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: 'center',
  },
  scrollChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  field: { marginBottom: 8 },
  statusCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
});
