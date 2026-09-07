import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Dialog, List, Portal, Snackbar, Text } from 'react-native-paper';
import { fetchUploadViewUrl } from '../../services/uploadsApi';
import { DocumentAddSourceMenu } from '../../components/documents/DocumentAddSourceMenu';
import { UserDocumentCard } from '../../components/documents/UserDocumentCard';
import { UserDocumentPreviewModal } from '../../components/documents/UserDocumentPreviewModal';
import { useTheme } from '../../contexts/ThemeContext';
import {
  ID_TYPE_NAMES,
  useBackendDocuments,
  type BackendDocumentType,
  type BackendUserDocument,
} from '../../hooks/useBackendDocuments';
import { useAgentVerificationStatus } from '../../hooks/useAgentVerificationStatus';
import { useBusinessVerificationStatus } from '../../hooks/useBusinessVerificationStatus';
import { useProfileMe } from '../../hooks/useProfileMe';
import {
  pickCameraPhoto,
  pickDocumentFile,
  type PickedUploadFile,
} from '../../utils/documentPickers';

type Persona = 'client' | 'agent' | 'business';

function resolvePickFailure(
  result: { ok: false; reason: string; message?: string },
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (result.reason === 'permission_denied') {
    return t('documents.cameraPermissionDenied', 'Camera permission is required to take a photo.');
  }
  if (result.reason === 'error' && result.message) {
    return result.message;
  }
  return t('documents.pickError', 'Could not select the file.');
}

function InfoBanner({ message }: { message: string }) {
  const { colors, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.info.main + '14', borderRadius: borderRadius.md },
      ]}
    >
      <MaterialCommunityIcons name="information-outline" size={20} color={colors.info.dark} />
      <Text style={[styles.bannerText, { color: colors.info.dark }]} variant="bodySmall">
        {message}
      </Text>
    </View>
  );
}

function AgentIdBanner() {
  const { t } = useTranslation();
  const { loading, idDocumentStatus } = useAgentVerificationStatus();
  if (loading || idDocumentStatus === 'approved') return null;
  return (
    <InfoBanner
      message={t(
        'agent.documents.idRequiredHint',
        'Upload a valid government ID (driver’s license, passport, or national ID) so we can activate your agent account.'
      )}
    />
  );
}

function BusinessIdBanner() {
  const { t } = useTranslation();
  const { status } = useBusinessVerificationStatus();
  if (!status || status.paymentRail === 'stripe') return null;
  if (status.is_verified) return null;
  const identity = status.steps.identity?.status;
  if (identity === 'approved' || identity === 'pending') return null;
  const nameHint = status.accountFullName
    ? t(
        'business.verification.idUploadHint',
        'Name on document must match: {{fullName}}',
        { fullName: status.accountFullName }
      )
    : null;
  return (
    <>
      <InfoBanner
        message={t(
          'business.verification.idUploadInstruction',
          'Upload a valid ID that matches your profile name to earn a Verified badge on your store. It gives clients more confidence.'
        )}
      />
      {nameHint ? <InfoBanner message={nameHint} /> : null}
    </>
  );
}

function sortTypesIdFirst(types: BackendDocumentType[]): BackendDocumentType[] {
  const idTypes = types.filter((dt) => ID_TYPE_NAMES.includes(dt.name));
  const rest = types.filter((dt) => !ID_TYPE_NAMES.includes(dt.name));
  return [...idTypes, ...rest];
}

interface PreviewState {
  doc: BackendUserDocument;
  url: string | null;
  loading: boolean;
  error: string | null;
}

function UserDocumentsView({
  persona,
  returnToDashboard = false,
}: {
  persona: Persona;
  returnToDashboard?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const navigation = useNavigation();
  const { documents, documentTypes, loading, uploading, error, refetch, uploadFile } =
    useBackendDocuments(true);
  const { status: businessStatus, refetch: refetchBusinessStatus } =
    useBusinessVerificationStatus(persona === 'business');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<PickedUploadFile | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const sortedTypes = useMemo(
    () => (persona === 'client' ? documentTypes : sortTypesIdFirst(documentTypes)),
    [documentTypes, persona]
  );

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [documents]
  );

  const goToBusinessDashboard = useCallback(() => {
    if (returnToDashboard) {
      navigation.navigate(
        'BusinessMainTabs' as never,
        { screen: 'BusinessDashboard' } as never
      );
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, returnToDashboard]);

  const handleChooseFile = useCallback(async () => {
    setSourceMenuOpen(false);
    const result = await pickDocumentFile();
    if (!result.ok) {
      if (result.reason !== 'canceled') setSnackbar(resolvePickFailure(result, t));
      return;
    }
    setPendingFile(result.file);
    setTypeMenuOpen(true);
  }, [t]);

  const handleTakePhoto = useCallback(async () => {
    setSourceMenuOpen(false);
    const result = await pickCameraPhoto();
    if (!result.ok) {
      if (result.reason !== 'canceled') setSnackbar(resolvePickFailure(result, t));
      return;
    }
    setPendingFile(result.file);
    setTypeMenuOpen(true);
  }, [t]);

  const handleUploadType = useCallback(
    async (typeId: number) => {
      setTypeMenuOpen(false);
      const file = pendingFile;
      setPendingFile(null);
      if (!file) return;
      const uploadedType = documentTypes.find((dt) => dt.id === typeId);
      const isIdDocument = Boolean(
        uploadedType && ID_TYPE_NAMES.includes(uploadedType.name)
      );
      const neededId =
        persona === 'business' &&
        businessStatus?.nextAction === 'upload_id' &&
        isIdDocument;
      const ok = await uploadFile(typeId, file);
      if (ok) {
        setSnackbar(t('documents.uploadSuccess', 'Document uploaded'));
        if (neededId) {
          await refetchBusinessStatus();
          navigation.replace(
            'BusinessSetupStepSuccess' as never,
            { step: 'identity', variant: 'continue' } as never
          );
          return;
        }
        if (returnToDashboard) {
          goToBusinessDashboard();
        }
      } else if (error) {
        setSnackbar(error);
      }
    },
    [
      pendingFile,
      uploadFile,
      error,
      t,
      persona,
      businessStatus?.nextAction,
      documentTypes,
      refetchBusinessStatus,
      goToBusinessDashboard,
      navigation,
      returnToDashboard,
    ]
  );

  const handleOpenDocument = useCallback(
    async (doc: BackendUserDocument) => {
      if (doc.content_type?.startsWith('image/')) {
        setPreview({ doc, url: null, loading: true, error: null });
        try {
          const url = await fetchUploadViewUrl(doc.id);
          if (!url) throw new Error();
          setPreview({ doc, url, loading: false, error: null });
        } catch {
          setPreview({
            doc,
            url: null,
            loading: false,
            error: t('documents.previewError', 'Could not load the preview.'),
          });
        }
        return;
      }
      setOpeningId(doc.id);
      try {
        const url = await fetchUploadViewUrl(doc.id);
        if (!url) throw new Error();
        await WebBrowser.openBrowserAsync(url);
      } catch {
        setSnackbar(t('documents.openError', 'Could not open the document.'));
      } finally {
        setOpeningId(null);
      }
    },
    [t]
  );

  const handleOpenPreviewExternally = useCallback(() => {
    if (preview?.url) void WebBrowser.openBrowserAsync(preview.url);
  }, [preview]);

  if (loading && documents.length === 0 && !error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }, typography.body2]}>
          {t('common.loading', 'Loading…')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <Text style={[styles.title, { color: colors.text.primary }, typography.h6]}>
        {t('documents.title', 'My documents')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }, typography.body2]}>
        {t('documents.subtitle', 'Add and manage your documents (ID, license, etc.).')}
      </Text>

      {persona === 'agent' ? <AgentIdBanner /> : null}
      {persona === 'business' ? <BusinessIdBanner /> : null}

      {error ? (
        <View style={styles.errorBlock}>
          <Text style={[styles.errorText, { color: colors.error.main }, typography.body2]}>
            {error}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]}
          >
            <Text style={[{ color: colors.primary.contrast }, typography.button]}>
              {t('common.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <DocumentAddSourceMenu
        visible={sourceMenuOpen}
        onOpen={() => setSourceMenuOpen(true)}
        onDismiss={() => setSourceMenuOpen(false)}
        onChooseFile={() => void handleChooseFile()}
        onTakePhoto={() => void handleTakePhoto()}
        loading={uploading}
        disabled={uploading || documentTypes.length === 0}
        buttonStyle={styles.addButton}
      />

      <Portal>
        <Dialog
          visible={typeMenuOpen && !!pendingFile}
          onDismiss={() => {
            setTypeMenuOpen(false);
            setPendingFile(null);
          }}
        >
          <Dialog.Title>{t('documents.selectType', 'Select document type')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.typeScrollArea}>
            <FlatList
              data={sortedTypes}
              keyExtractor={(dt) => String(dt.id)}
              renderItem={({ item: dt }) => (
                <List.Item
                  title={dt.description || dt.name}
                  onPress={() => void handleUploadType(dt.id)}
                />
              )}
            />
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>

      <FlatList
        data={sortedDocuments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refetch()}
            colors={[colors.primary.main]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons
                name="file-document-multiple-outline"
                size={48}
                color={colors.text.disabled}
              />
              <Text style={[styles.empty, { color: colors.text.secondary }, typography.body2]}>
                {t('documents.empty', 'No documents. Tap « Add document » to add one.')}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <UserDocumentCard
            doc={item}
            opening={openingId === item.id}
            onPress={(doc) => void handleOpenDocument(doc)}
          />
        )}
      />

      <UserDocumentPreviewModal
        visible={!!preview}
        fileName={preview?.doc.file_name ?? null}
        url={preview?.url ?? null}
        loading={preview?.loading ?? false}
        error={preview?.error ?? null}
        onDismiss={() => setPreview(null)}
        onOpenExternally={handleOpenPreviewExternally}
      />

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

export default function DocumentsScreen() {
  const { me, loading } = useProfileMe();
  const route = useRoute();
  const returnToDashboard =
    (route.params as { returnToDashboard?: boolean } | undefined)?.returnToDashboard ===
    true;

  if (loading && !me) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const persona: Persona = me?.business ? 'business' : me?.agent ? 'agent' : 'client';
  return (
    <UserDocumentsView persona={persona} returnToDashboard={returnToDashboard} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 16 },
  loadingText: { marginTop: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 12,
  },
  bannerText: { flex: 1, minWidth: 0, marginLeft: 8 },
  errorBlock: { marginBottom: 16 },
  errorText: { marginBottom: 8 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start' },
  addButton: { marginBottom: 12, alignSelf: 'stretch' },
  typeScrollArea: { maxHeight: 420, paddingHorizontal: 0 },
  list: { paddingBottom: 48 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  empty: { textAlign: 'center', marginTop: 12 },
});
