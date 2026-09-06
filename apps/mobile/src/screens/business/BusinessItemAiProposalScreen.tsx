import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Icon,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  acceptBusinessItemAiProposal,
  declineBusinessItemAiProposal,
  fetchBusinessItemAiProposal,
} from '../../services/adminItemsApi';
import { businessApi } from '../../services/businessApi';
import type { BusinessItemAiProposalPayload } from '../../types/adminItems';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessItemAiProposal'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function BusinessItemAiProposalScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const itemId = route.params.itemId;

  const [data, setData] = useState<BusinessItemAiProposalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [applyTitle, setApplyTitle] = useState(false);
  const [applyDescription, setApplyDescription] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupRequested, setCleanupRequested] = useState(false);
  const [cleanupJobOpen, setCleanupJobOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, openRes] = await Promise.all([
        fetchBusinessItemAiProposal(itemId),
        businessApi.aiImageCleanup.getOpenForItem(itemId).catch(() => null),
      ]);
      setData(res);
      setTitle(res.proposal?.proposed_title ?? res.item?.name ?? '');
      setDescription(
        res.proposal?.proposed_description ?? res.item?.description ?? ''
      );
      setApplyTitle(!!res.proposal?.proposed_title);
      setApplyDescription(!!res.proposal?.proposed_description);
      setCleanupJobOpen(!!openRes?.data?.open);
      if (openRes?.data?.open) {
        setCleanupRequested(true);
      }
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Failed to load proposal');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAccept = async (asIs: boolean) => {
    setBusy(true);
    try {
      const edits = asIs
        ? { applyTitle: false, applyDescription: false }
        : {
            applyTitle,
            applyDescription,
            ...(applyTitle ? { title: title.trim() } : {}),
            ...(applyDescription ? { description: description.trim() } : {}),
          };
      const ok = await acceptBusinessItemAiProposal(itemId, edits);
      if (!ok) throw new Error('Accept failed');
      setSnack(
        asIs
          ? t(
              'business.items.aiProposal.publishAsIsSuccess',
              'Published without changes'
            )
          : t('business.items.aiProposal.acceptSuccess', 'Proposal accepted')
      );
      navigation.goBack();
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    setBusy(true);
    try {
      const ok = await declineBusinessItemAiProposal(itemId);
      if (!ok) throw new Error('Decline failed');
      setSnack(
        t(
          'business.items.aiProposal.declineSuccess',
          'Proposal declined; re-reviewing'
        )
      );
      navigation.goBack();
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Decline failed');
    } finally {
      setBusy(false);
    }
  };

  const onRequestCleanup = async () => {
    setCleanupBusy(true);
    try {
      await businessApi.aiImageCleanup.request(itemId);
      setCleanupRequested(true);
      setCleanupJobOpen(true);
      setSnack(
        t(
          'business.images.asyncCleanup.started',
          'AI cleanup started — we’ll notify you when ready.'
        )
      );
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('business.images.asyncCleanup.startFailed', 'Could not start AI cleanup')
      );
    } finally {
      setCleanupBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const original = data?.item;
  const proposal = data?.proposal;
  const canAct =
    !!original &&
    original.moderation_status === 'proposal_pending' &&
    !!proposal;

  if (!canAct) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
      >
        <Text style={[typography.h6, { color: colors.text.primary }]}>
          {t('business.items.aiProposal.title', 'Review AI suggestions')}
        </Text>
        <View
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              marginTop: spacing.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={{ color: colors.text.secondary }}>
            {t(
              'business.items.aiProposal.notAvailable',
              'No AI proposal is waiting for this item.'
            )}
          </Text>
        </View>
        <Snackbar
          visible={!!snack}
          onDismiss={() => setSnack(null)}
          duration={4000}
        >
          {snack}
        </Snackbar>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
    >
      <Text style={[typography.h6, { color: colors.text.primary }]}>
        {t('business.items.aiProposal.title', 'Review AI suggestions')}
      </Text>
      {proposal?.decision_reason ? (
        <Text style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
          {proposal.decision_reason}
        </Text>
      ) : null}

      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            marginTop: spacing.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text style={{ color: colors.text.secondary, marginBottom: 4 }}>
          {t('business.items.aiProposal.currentTitle', 'Current title')}
        </Text>
        <Text style={{ color: colors.text.primary }}>{original?.name}</Text>
        {proposal?.proposed_title ? (
          <>
            <View style={[styles.toggleRow, { marginTop: spacing.md }]}>
              <Text style={{ color: colors.text.primary, flex: 1 }}>
                {t('business.items.aiProposal.applyTitle', 'Use AI suggested title')}
              </Text>
              <Switch
                value={applyTitle}
                onValueChange={setApplyTitle}
                disabled={busy}
              />
            </View>
            <TextInput
              mode="outlined"
              label={t('business.items.aiProposal.suggestedTitle', 'Suggested title')}
              value={title}
              onChangeText={setTitle}
              disabled={busy || !applyTitle}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : null}
        <Text style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('business.items.aiProposal.currentDescription', 'Current description')}
        </Text>
        <Text style={{ color: colors.text.primary }}>
          {original?.description || '—'}
        </Text>
        {proposal?.proposed_description ? (
          <>
            <View style={[styles.toggleRow, { marginTop: spacing.md }]}>
              <Text style={{ color: colors.text.primary, flex: 1 }}>
                {t(
                  'business.items.aiProposal.applyDescription',
                  'Use AI suggested description'
                )}
              </Text>
              <Switch
                value={applyDescription}
                onValueChange={setApplyDescription}
                disabled={busy}
              />
            </View>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={5}
              label={t(
                'business.items.aiProposal.suggestedDescription',
                'Suggested description'
              )}
              value={description}
              onChangeText={setDescription}
              disabled={busy || !applyDescription}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : null}
      </View>

      {!cleanupJobOpen && !cleanupRequested ? (
        <View
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              marginTop: spacing.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.cleanupHeader}>
            <Icon source="auto-fix" size={20} color={colors.primary.main} />
            <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
              {t('business.items.aiProposal.cleanupTitle', 'Want cleaner photos?')}
            </Text>
          </View>
          <Text style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
            {t(
              'business.items.aiProposal.cleanupHint',
              'Optionally run AI photo cleanup in the background (1 AI token per photo). You review before & after — nothing changes without your approval.'
            )}
          </Text>
          <Button
            mode="outlined"
            icon="auto-fix"
            loading={cleanupBusy}
            disabled={busy || cleanupBusy}
            style={{ marginTop: spacing.sm }}
            onPress={() => void onRequestCleanup()}
          >
            {t('business.items.aiProposal.cleanupCta', 'Clean up photos with AI')}
          </Button>
        </View>
      ) : null}

      <Button
        mode="contained"
        disabled={busy || (!applyTitle && !applyDescription)}
        loading={busy}
        style={{ marginTop: spacing.lg }}
        onPress={() => void onAccept(false)}
      >
        {t('business.items.aiProposal.applySelected', 'Apply selected & publish')}
      </Button>
      <Button
        mode="outlined"
        disabled={busy}
        style={{ marginTop: spacing.sm }}
        onPress={() => void onAccept(true)}
      >
        {t('business.items.aiProposal.publishAsIs', 'Publish without changes')}
      </Button>
      <Button
        mode="text"
        disabled={busy}
        textColor={colors.text.secondary}
        style={{ marginTop: spacing.sm }}
        onPress={() => void onDecline()}
      >
        {t('business.items.aiProposal.decline', 'Decline & resubmit for AI review')}
      </Button>
      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginTop: spacing.sm },
        ]}
      >
        {t(
          'business.items.aiProposal.actionsHint',
          '"Publish without changes" publishes the item exactly as you wrote it. Declining sends it back for another AI review.'
        )}
      </Text>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  cleanupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
