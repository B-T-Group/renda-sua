import { usePermissions } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  approveUpload,
  confirmMobileMoneyReady,
  fetchAdminBusinessVerification,
  fetchBusinessContractDownloadUrl,
  fetchUploadViewUrl,
  rejectUpload,
  resendBusinessContract,
  adminChangeBusinessAccountType,
  reinstateBusiness,
  suspendBusiness,
} from '../../services/adminBusinessesApi';
import { threadsApi } from '../../services/threadsApi';
import type { AdminBusinessVerificationDetails } from '../../types/adminBusinesses';
import { formatBusinessNextStep } from '../../utils/adminBusinessNextStep';
import {
  isImageUpload,
  isPdfUpload,
} from '../../utils/adminBusinessVerification';
import { accurateLifecyclePill } from '../../utils/adminLifecycleUi';
import {
  ID_REFUSAL_PRETEXTS,
  reminderPretextsForIdStatus,
  type IdPretextDefinition,
} from '../../utils/adminIdPretexts';
type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'AdminBusinessVerification'
>;

export default function AdminBusinessVerificationScreen({ route }: Props) {
  const { businessId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { me, loading: profileLoading } = useProfileMe();
  const { can, isSuperuser } = usePermissions(me);
  const isAdmin =
    isSuperuser || can(PlatformPermissions.MANAGE_BUSINESSES);
  const canManageDocs =
    isSuperuser || can(PlatformPermissions.OPS_USER_DOCUMENTS);
  const canManageContracts =
    isSuperuser || can(PlatformPermissions.MANAGE_CONTRACTS);
  const canSendMessages =
    isSuperuser || can(PlatformPermissions.OPS_USER_MESSAGES);
  const { height: screenHeight } = useWindowDimensions();

  const [details, setDetails] =
    useState<AdminBusinessVerificationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [snack, setSnack] = useState<string | null>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('STANDARD');
  const [accountTypeBusy, setAccountTypeBusy] = useState(false);
  const [pretextBusy, setPretextBusy] = useState(false);

  const loadPreviews = useCallback(
    async (docs: AdminBusinessVerificationDetails['identityDocuments']) => {
      if (!canManageDocs) {
        setPreviewUrls({});
        return;
      }
      const urls: Record<string, string> = {};
      await Promise.all(
        (docs ?? []).map(async (doc) => {
          try {
            const url = await fetchUploadViewUrl(doc.id);
            if (url) urls[doc.id] = url;
          } catch {
            // Preview failures must not wipe the verification screen.
          }
        })
      );
      setPreviewUrls(urls);
    },
    [canManageDocs]
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAdmin) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminBusinessVerification(businessId);
        if (!data.business) {
          setDetails(null);
          setError(
            t(
              'admin.businesses.verificationLoadError',
              'Failed to load verification details'
            )
          );
          return;
        }
        setDetails(data);
        setSelectedAccountType(data.business.account_type ?? 'STANDARD');
        void loadPreviews(data.identityDocuments);
      } catch (e: unknown) {
        setDetails(null);
        setError(
          e instanceof Error
            ? e.message
            : t(
                'admin.businesses.verificationLoadError',
                'Failed to load verification details'
              )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessId, isAdmin, loadPreviews, t]
  );

  useEffect(() => {
    if (!profileLoading && isAdmin) void load();
  }, [isAdmin, load, profileLoading]);

  const agreementComplete = Boolean(
    details?.latestContract?.complete || details?.latestAcceptance
  );
  const hasApprovedId = Boolean(
    details?.identityDocuments?.some((d) => d.is_approved)
  );
  const rail = details?.rail ?? 'mobile_money';
  const mmAccount = details?.paymentAccounts?.find(
    (a) => a.provider === 'mobile_money'
  );
  const mmVerified = mmAccount?.capability_status === 'verified';
  const canConfirmMm =
    rail === 'mobile_money' &&
    !mmVerified &&
    agreementComplete &&
    hasApprovedId;

  const idDocumentStatus = useMemo(() => {
    const docs = details?.identityDocuments ?? [];
    if (!docs.length) return 'missing' as const;
    if (docs.some((d) => d.is_approved)) return 'approved' as const;
    const latest = docs[0];
    if (latest?.note?.trim() && !latest.is_approved) return 'rejected' as const;
    return 'pending' as const;
  }, [details?.identityDocuments]);

  const nextStep = useMemo(() => {
    if (!details) return null;
    return formatBusinessNextStep(
      {
        lifecycle_status: details.business.lifecycle_status,
        verificationSummary: {
          contractStatus: agreementComplete ? 'signed' : 'missing',
          contractComplete: agreementComplete,
          idDocumentStatus,
          blockers: details.blockers,
          rail,
        },
      },
      t
    );
  }, [agreementComplete, details, idDocumentStatus, rail, t]);

  const reminders = useMemo(
    () => reminderPretextsForIdStatus(idDocumentStatus),
    [idDocumentStatus]
  );

  const openUrl = useCallback(async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  }, []);

  const sendReminder = useCallback(
    async (pretext: IdPretextDefinition) => {
      const uid = details?.business.user?.id;
      if (!uid || !canSendMessages || pretextBusy) return;
      setPretextBusy(true);
      try {
        const subject = pretext.subjectKey
          ? t(pretext.subjectKey, pretext.subjectDefault ?? '')
          : undefined;
        const body = t(pretext.bodyKey, pretext.bodyDefault);
        const result = await threadsApi.adminSendThread({
          recipientUserId: uid,
          subject,
          body,
        });
        setSnack(
          result.success
            ? t('admin.users.messageSent', 'Message sent')
            : t('admin.businesses.actionFailed', 'Action failed')
        );
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t('admin.businesses.actionFailed', 'Action failed')
        );
      } finally {
        setPretextBusy(false);
      }
    },
    [canSendMessages, details?.business.user?.id, pretextBusy, t]
  );

  const onApprove = useCallback(
    async (uploadId: string) => {
      if (!canManageDocs) return;
      setActionBusy(true);
      try {
        const ok = await approveUpload(uploadId);
        setSnack(
          ok
            ? t('admin.businesses.approveSuccess', 'Document approved')
            : t('admin.businesses.actionFailed', 'Action failed')
        );
        if (ok) await load({ silent: true });
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t('admin.businesses.actionFailed', 'Action failed')
        );
      } finally {
        setActionBusy(false);
      }
    },
    [canManageDocs, load, t]
  );

  const onReject = useCallback(async () => {
    if (!canManageDocs || !rejectId || !rejectNote.trim()) return;
    setActionBusy(true);
    try {
      const ok = await rejectUpload(rejectId, rejectNote.trim());
      setRejectId(null);
      setRejectNote('');
      setSnack(
        ok
          ? t('admin.businesses.rejectSuccess', 'Document rejected')
          : t('admin.businesses.actionFailed', 'Action failed')
      );
      if (ok) await load({ silent: true });
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.businesses.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [canManageDocs, load, rejectId, rejectNote, t]);

  const onSaveAccountType = useCallback(async () => {
    if (!isAdmin || !details) return;
    setAccountTypeBusy(true);
    try {
      await adminChangeBusinessAccountType(businessId, selectedAccountType);
      await load({ silent: true });
      setSnack(t('admin.businesses.accountTypeSection', 'Business Account Type') + ': saved');
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('admin.businesses.actionFailed', 'Action failed'));
    } finally {
      setAccountTypeBusy(false);
    }
  }, [businessId, details, isAdmin, load, selectedAccountType, t]);

  const runLifecycleAction = useCallback(
    async (action: () => Promise<boolean>, successKey: string, successDefault: string) => {
      setActionBusy(true);
      try {
        await action();
        setSnack(t(successKey, successDefault));
        await load({ silent: true });
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t('admin.businesses.actionFailed', 'Action failed')
        );
      } finally {
        setActionBusy(false);
      }
    },
    [load, t]
  );

  const onReinstate = useCallback(() => {
    Alert.alert(
      t('admin.businesses.reinstate', 'Reinstate'),
      t(
        'admin.businesses.reinstateConfirm',
        'Restore this store so it can accept orders again?'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.businesses.reinstate', 'Reinstate'),
          onPress: () =>
            void runLifecycleAction(
              () => reinstateBusiness(businessId),
              'admin.businesses.reinstateSuccess',
              'Store reinstated'
            ),
        },
      ]
    );
  }, [businessId, runLifecycleAction, t]);

  const onSuspend = useCallback(() => {
    Alert.alert(
      t('admin.businesses.suspend', 'Suspend'),
      t(
        'admin.businesses.suspendConfirm',
        'Hide this store and stop new orders?'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.businesses.suspend', 'Suspend'),
          style: 'destructive',
          onPress: () =>
            void runLifecycleAction(
              () =>
                suspendBusiness(
                  businessId,
                  t('admin.businesses.suspendDefaultReason', 'Suspended by admin')
                ),
              'admin.businesses.suspendSuccess',
              'Store suspended'
            ),
        },
      ]
    );
  }, [businessId, runLifecycleAction, t]);

  const onConfirmMm = useCallback(async () => {
    setActionBusy(true);
    try {
      const ok = await confirmMobileMoneyReady(businessId);
      setSnack(
        ok
          ? t(
              'admin.businesses.confirmMobileMoneySuccess',
              'Mobile money confirmed'
            )
          : t('admin.businesses.actionFailed', 'Action failed')
      );
      if (ok) await load({ silent: true });
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.businesses.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [businessId, load, t]);

  const onResendContract = useCallback(async () => {
    if (!canManageContracts) return;
    setActionBusy(true);
    try {
      const ok = await resendBusinessContract(businessId);
      setSnack(
        ok
          ? t(
              'admin.businesses.resendContractSuccess',
              'Contract reminder sent'
            )
          : t('admin.businesses.actionFailed', 'Action failed')
      );
      if (ok) await load({ silent: true });
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.businesses.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [businessId, canManageContracts, load, t]);

  const onDownloadContract = useCallback(async () => {
    if (!canManageContracts || !details?.latestContract?.contractId) return;
    setActionBusy(true);
    try {
      const url = await fetchBusinessContractDownloadUrl(
        businessId,
        details.latestContract.contractId
      );
      if (url) await openUrl(url);
      else {
        setSnack(t('admin.businesses.actionFailed', 'Action failed'));
      }
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.businesses.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [
    businessId,
    canManageContracts,
    details?.latestContract?.contractId,
    openUrl,
    t,
  ]);

  if (profileLoading || (loading && !details)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text variant="titleMedium" style={{ textAlign: 'center' }}>
          {t('admin.businesses.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  if (error && !details) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text style={{ color: colors.error.main, textAlign: 'center' }}>
          {error}
        </Text>
        <Button mode="outlined" style={{ marginTop: spacing.md }} onPress={() => void load()}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  if (!details) return null;

  const sectionStyle = {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          paddingBottom: spacing.xl + insets.bottom + 72,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
          />
        }
      >
        <View style={{ gap: spacing.xs }}>
          <Text
            style={[
              typography.h5,
              { color: colors.text.primary },
            ]}
          >
            {details.business.name}
          </Text>
          <Text style={[typography.body2, { color: colors.text.secondary }]}>
            {details.business.user.first_name} {details.business.user.last_name}
          </Text>
          {details.business.created_at ? (
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('admin.businesses.createdAt', 'Created')}:{' '}
              {new Date(details.business.created_at).toLocaleDateString()}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {(() => {
              const life = accurateLifecyclePill(
                details.business.lifecycle_status,
                colors,
                t
              );
              return (
                <StatusPill
                  compact
                  label={life.label}
                  backgroundColor={life.backgroundColor}
                  textColor={life.textColor}
                />
              );
            })()}
            <StatusPill
              compact
              label={t(
                `admin.businesses.idStatus.${idDocumentStatus}`,
                idDocumentStatus
              )}
              backgroundColor={
                idDocumentStatus === 'approved'
                  ? `${colors.success.main}22`
                  : idDocumentStatus === 'pending'
                    ? `${colors.warning.main}22`
                    : idDocumentStatus === 'rejected'
                      ? `${colors.error.main}22`
                      : `${colors.text.secondary}18`
              }
              textColor={
                idDocumentStatus === 'approved'
                  ? colors.success.dark ?? colors.success.main
                  : idDocumentStatus === 'pending'
                    ? colors.warning.dark ?? colors.warning.main
                    : idDocumentStatus === 'rejected'
                      ? colors.error.dark ?? colors.error.main
                      : colors.text.secondary
              }
            />
            <StatusPill
              compact
              label={
                rail === 'stripe'
                  ? t('admin.businesses.railStripe', 'Stripe')
                  : t('admin.businesses.railMobileMoney', 'Mobile money')
              }
              backgroundColor={`${colors.info.main}22`}
              textColor={colors.info.dark ?? colors.info.main}
            />
          </View>
          {nextStep ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
              {nextStep}
            </Text>
          ) : null}
          {canSendMessages && reminders.length > 0 ? (
            <View style={{ marginTop: spacing.sm, gap: 8 }}>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('admin.businesses.pretexts.quickReminders', 'Quick reminders')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {reminders.map((pretext) => (
                  <Button
                    key={pretext.key}
                    mode="contained-tonal"
                    compact
                    disabled={pretextBusy}
                    onPress={() => void sendReminder(pretext)}
                  >
                    {t(pretext.labelKey, pretext.labelDefault)}
                  </Button>
                ))}
              </View>
            </View>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: spacing.sm,
            }}
          >
            {details.business.lifecycle_status === 'suspended' ? (
              <Button
                mode="contained"
                disabled={actionBusy}
                onPress={onReinstate}
              >
                {t('admin.businesses.reinstate', 'Reinstate')}
              </Button>
            ) : (
              <Button
                mode="outlined"
                textColor={colors.error.main}
                disabled={actionBusy}
                onPress={onSuspend}
              >
                {t('admin.businesses.suspend', 'Suspend')}
              </Button>
            )}
          </View>
        </View>

        {/* Contract */}
        <View style={sectionStyle}>
          <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
            {t('admin.businesses.checklist.contract', 'Contract')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {agreementComplete
              ? t('admin.businesses.contractSigned', 'Signed')
              : t('admin.businesses.contractPending', 'Pending')}
          </Text>
          {!agreementComplete ? (
            <Text variant="bodySmall" style={{ color: colors.warning.dark, marginTop: 8 }}>
              {t(
                'admin.businesses.noAgreement',
                'No merchant agreement on file. Ask the business to sign the agreement in the app.'
              )}
            </Text>
          ) : null}
          {canManageContracts &&
          details.latestContract?.boldSignEnabled &&
          !details.latestContract.complete ? (
            <Button
              mode="outlined"
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
              disabled={actionBusy}
              onPress={() => void onResendContract()}
            >
              {t('admin.businesses.resendContract', 'Resend contract')}
            </Button>
          ) : null}
          {canManageContracts &&
          details.latestContract?.contractId &&
          details.latestContract.canDownload ? (
            <Button
              mode="text"
              style={{ alignSelf: 'flex-start' }}
              disabled={actionBusy}
              onPress={() => void onDownloadContract()}
            >
              {t('admin.businesses.viewAgreementPdf', 'View signed PDF')}
            </Button>
          ) : null}
          {!canManageContracts &&
          (details.latestContract?.boldSignEnabled ||
            details.latestContract?.canDownload) ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: 8 }}
            >
              {t(
                'admin.businesses.contractsPermissionRequired',
                'Contract actions require manage-contracts permission.'
              )}
            </Text>
          ) : null}
        </View>

        {/* Identity */}
        <View style={sectionStyle}>
          <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
            {t('admin.businesses.idDocuments', 'Identity documents')}
          </Text>
          {!canManageDocs ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 8 }}>
              {t(
                'admin.businesses.docsPermissionRequired',
                'Document preview and approve/reject require user-documents permission.'
              )}
            </Text>
          ) : null}
          {(details.identityDocuments?.length ?? 0) === 0 ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t(
                'admin.businesses.noIdDocument',
                'No ID document uploaded. Ask the business to upload ID from Documents.'
              )}
            </Text>
          ) : (
            details.identityDocuments.map((doc) => {
              const rejected = Boolean(doc.note?.trim()) && !doc.is_approved;
              const url = previewUrls[doc.id];
              const showImage = isImageUpload(doc.content_type, doc.file_name);
              return (
                <View key={doc.id} style={{ marginBottom: spacing.md }}>
                  <Text variant="bodyMedium">{doc.file_name}</Text>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {doc.document_type?.name ?? ''} •{' '}
                    {doc.is_approved
                      ? t('admin.businesses.docApproved', 'Approved')
                      : rejected
                        ? t('admin.businesses.docRejected', 'Rejected')
                        : t('admin.businesses.docPending', 'Pending')}
                  </Text>
                  {rejected ? (
                    <Text variant="bodySmall" style={{ color: colors.error.main }}>
                      {doc.note}
                    </Text>
                  ) : null}
                  {url && showImage ? (
                    <Image
                      source={{ uri: url }}
                      style={{
                        width: '100%',
                        height: 280,
                        marginTop: spacing.sm,
                        borderRadius: borderRadius.md,
                        backgroundColor: colors.pageBackground,
                      }}
                      resizeMode="contain"
                    />
                  ) : null}
                  {url && isPdfUpload(doc.content_type, doc.file_name) ? (
                    <Button
                      mode="outlined"
                      style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                      onPress={() => void openUrl(url)}
                    >
                      {t('admin.businesses.openPdf', 'Open PDF')}
                    </Button>
                  ) : null}
                  {url ? (
                    <Button
                      mode="text"
                      style={{ alignSelf: 'flex-start' }}
                      onPress={() => void openUrl(url)}
                    >
                      {t('admin.businesses.openFullSize', 'Open full size')}
                    </Button>
                  ) : null}
                  {canManageDocs ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {!doc.is_approved ? (
                        <Button
                          mode="contained"
                          disabled={actionBusy}
                          onPress={() => void onApprove(doc.id)}
                        >
                          {rejected
                            ? t(
                                'admin.businesses.approveUndoReject',
                                'Approve (undo rejection)'
                              )
                            : t('admin.businesses.approve', 'Approve')}
                        </Button>
                      ) : null}
                      {!doc.is_approved ? (
                        <Button
                          mode="outlined"
                          textColor={colors.error.main}
                          disabled={actionBusy}
                          onPress={() => {
                            setRejectId(doc.id);
                            setRejectNote('');
                          }}
                        >
                          {t('admin.businesses.reject', 'Reject')}
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Payment */}
        <View style={sectionStyle}>
          <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
            {t('admin.businesses.checklist.payment', 'Payment')}
          </Text>
          {rail === 'stripe' ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t(
                'admin.businesses.stripePaymentHelp',
                'Stripe Connect status updates automatically. No mobile money confirmation is needed.'
              )}
            </Text>
          ) : (
            <>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t(
                  'admin.businesses.confirmMobileMoneyHelp',
                  'Confirm that this merchant’s mobile money account can receive payouts. This is the last payment step for non-Stripe businesses.'
                )}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 8 }}>
                mobile_money:{' '}
                {mmAccount?.capability_status ||
                  t('admin.businesses.paymentNotStarted', 'not started')}
              </Text>
              {mmVerified &&
              details.business.lifecycle_status === 'created' &&
              !agreementComplete ? (
                <Text
                  variant="bodySmall"
                  style={{ color: colors.info.dark ?? colors.info.main, marginTop: 8 }}
                >
                  {t(
                    'admin.businesses.paymentConfirmedNeedContract',
                    'Payment verified. Sign the merchant contract to leave Draft.'
                  )}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Catalog */}
        <View style={sectionStyle}>
          <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
            {t('admin.businesses.catalogSection', 'Catalog / storefront')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {details.catalog?.hasLocation
              ? t('admin.businesses.catalogHasLocation', 'Active location: yes')
              : t(
                  'admin.businesses.catalogMissingLocation',
                  'Active location: no'
                )}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {details.catalog?.hasApprovedItem
              ? t(
                  'admin.businesses.catalogHasApprovedProduct',
                  'Approved product: yes'
                )
              : t(
                  'admin.businesses.catalogMissingApprovedProduct',
                  'Approved product: no'
                )}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {details.catalog?.hasApprovedRental
              ? t(
                  'admin.businesses.catalogHasApprovedRental',
                  'Approved rental: yes'
                )
              : t(
                  'admin.businesses.catalogMissingApprovedRental',
                  'Approved rental: no'
                )}
          </Text>
          {!details.catalog?.complete ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.warning.dark, marginTop: 8 }}
            >
              {t(
                'admin.businesses.catalogStorefrontHelp',
                'Catalog completeness affects storefront readiness, not lifecycle status. Lifecycle becomes Active once the contract is signed and payment (or approved ID for mobile money) is verified.'
              )}
            </Text>
          ) : null}
        </View>

        {/* Admin Account Type Control */}
        {isAdmin ? (
          <View style={sectionStyle}>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
              {t('admin.businesses.accountTypeSection', 'Business Account Type')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
              {t('admin.businesses.accountTypeLabel', 'Account Type')}
            </Text>
            {(['STANDARD', 'PREMIUM', 'ELITE'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setSelectedAccountType(type)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.xs,
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: selectedAccountType === type ? colors.primary.main : colors.text.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedAccountType === type ? (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary.main,
                      }}
                    />
                  ) : null}
                </View>
                <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
                  {type === 'STANDARD' ? t('business.accountType.plans.standard.label', 'Standard') + ' (12%)' :
                   type === 'PREMIUM' ? t('business.accountType.plans.premium.label', 'Premium') + ' (15%)' :
                   t('business.accountType.plans.elite.label', 'Elite') + ' (20%)'}
                </Text>
              </Pressable>
            ))}
            <Button
              mode="contained"
              compact
              loading={accountTypeBusy}
              disabled={accountTypeBusy || selectedAccountType === (details?.business.account_type ?? 'STANDARD')}
              onPress={() => void onSaveAccountType()}
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
            >
              {t('admin.businesses.saveAccountType', 'Save Plan')}
            </Button>
          </View>
        ) : null}
      </ScrollView>

      {canConfirmMm ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.md,
            paddingBottom: spacing.md + insets.bottom,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}
        >
          <Button
            mode="contained"
            disabled={actionBusy}
            onPress={() => void onConfirmMm()}
          >
            {t(
              'admin.businesses.confirmMobileMoneyReady',
              'Confirm mobile money ready'
            )}
          </Button>
        </View>
      ) : null}

      <Modal
        visible={!!rejectId}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!actionBusy) {
            setRejectId(null);
            setRejectNote('');
          }
        }}
        statusBarTranslucent
      >
        <Pressable
          style={styles.scrim}
          onPress={() => {
            if (!actionBusy) {
              setRejectId(null);
              setRejectNote('');
            }
          }}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.xl ?? borderRadius.md,
                maxHeight: screenHeight * 0.85,
                padding: spacing.md,
                paddingBottom: spacing.md + insets.bottom,
                ...shadows.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="titleLarge" style={{ marginBottom: spacing.sm }}>
              {t('admin.businesses.rejectTitle', 'Reject document')}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
            >
              {t(
                'admin.businesses.rejectMessageHelp',
                'Explain what is wrong so the merchant can upload a corrected document. They will receive this reason by email and in Messages.'
              )}
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: colors.text.secondary, marginBottom: spacing.xs }}
            >
              {t('admin.businesses.pretexts.quickRefusals', 'Quick refusal reasons')}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: spacing.sm,
              }}
            >
              {ID_REFUSAL_PRETEXTS.map((pretext) => (
                <Button
                  key={pretext.key}
                  mode="outlined"
                  compact
                  onPress={() =>
                    setRejectNote(t(pretext.bodyKey, pretext.bodyDefault))
                  }
                >
                  {t(pretext.labelKey, pretext.labelDefault)}
                </Button>
              ))}
            </View>
            <ScrollView
              style={{ maxHeight: screenHeight * 0.35 }}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                mode="outlined"
                multiline
                value={rejectNote}
                onChangeText={setRejectNote}
                label={t('admin.businesses.rejectPlaceholder', 'Reason')}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button
                mode="text"
                disabled={actionBusy}
                onPress={() => {
                  setRejectId(null);
                  setRejectNote('');
                }}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                disabled={actionBusy || !rejectNote.trim()}
                onPress={() => void onReject()}
              >
                {t('admin.businesses.reject', 'Reject')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
});
