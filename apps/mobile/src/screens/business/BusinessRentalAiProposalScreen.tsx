import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  acceptBusinessAiProposal,
  declineBusinessAiProposal,
  fetchBusinessAiProposal,
} from '../../services/adminRentalsApi';
import type { BusinessAiProposalPayload } from '../../types/adminRentals';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalAiProposal'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function BusinessRentalAiProposalScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const listingId = route.params.listingId;

  const [data, setData] = useState<BusinessAiProposalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [applyTitle, setApplyTitle] = useState(false);
  const [applyDescription, setApplyDescription] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBusinessAiProposal(listingId);
      setData(res);
      setTitle(res.proposal?.proposed_title ?? res.listing?.rental_item.name ?? '');
      setDescription(
        res.proposal?.proposed_description ??
          res.listing?.rental_item.description ??
          ''
      );
      setApplyTitle(!!res.proposal?.proposed_title);
      setApplyDescription(!!res.proposal?.proposed_description);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Failed to load proposal');
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const exitAfterProposal = useCallback(() => {
    const itemId = data?.listing?.rental_item?.id;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (itemId) {
      navigation.replace('BusinessRentalItemDetail', { itemId });
      return;
    }
    navigation.navigate('BusinessRentalsStudio', { tab: 'catalog' });
  }, [data?.listing?.rental_item?.id, navigation]);

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
      const ok = await acceptBusinessAiProposal(listingId, edits);
      if (!ok) throw new Error('Accept failed');
      setSnack(
        asIs
          ? t(
              'business.rentals.aiProposal.publishAsIsSuccess',
              'Published without changes'
            )
          : t('business.rentals.aiProposal.acceptSuccess', 'Proposal accepted')
      );
      exitAfterProposal();
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    setBusy(true);
    try {
      const ok = await declineBusinessAiProposal(listingId);
      if (!ok) throw new Error('Decline failed');
      setSnack(
        t('business.rentals.aiProposal.declineSuccess', 'Proposal declined; re-reviewing')
      );
      exitAfterProposal();
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Decline failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const original = data?.listing?.rental_item;
  const proposal = data?.proposal;
  const canAct =
    !!data?.listing &&
    data.listing.moderation_status === 'proposal_pending' &&
    !!proposal;

  if (!canAct) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
      >
        <Text style={[typography.h6, { color: colors.text.primary }]}>
          {t('business.rentals.aiProposal.title', 'Review AI suggestions')}
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
              'business.rentals.aiProposal.notAvailable',
              'No AI proposal is waiting for this listing.'
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
        {t('business.rentals.aiProposal.title', 'Review AI suggestions')}
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
          {t('business.rentals.aiProposal.currentTitle', 'Current title')}
        </Text>
        <Text style={{ color: colors.text.primary }}>{original?.name}</Text>
        {proposal?.proposed_title ? (
          <>
            <View style={[styles.toggleRow, { marginTop: spacing.md }]}>
              <Text style={{ color: colors.text.primary, flex: 1 }}>
                {t('business.rentals.aiProposal.applyTitle', 'Use AI suggested title')}
              </Text>
              <Switch
                value={applyTitle}
                onValueChange={setApplyTitle}
                disabled={busy}
              />
            </View>
            <TextInput
              mode="outlined"
              label={t('business.rentals.aiProposal.suggestedTitle', 'Suggested title')}
              value={title}
              onChangeText={setTitle}
              disabled={busy || !applyTitle}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : null}
        <Text style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('business.rentals.aiProposal.currentDescription', 'Current description')}
        </Text>
        <Text style={{ color: colors.text.primary }}>
          {original?.description || '—'}
        </Text>
        {proposal?.proposed_description ? (
          <>
            <View style={[styles.toggleRow, { marginTop: spacing.md }]}>
              <Text style={{ color: colors.text.primary, flex: 1 }}>
                {t(
                  'business.rentals.aiProposal.applyDescription',
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
                'business.rentals.aiProposal.suggestedDescription',
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

      <Button
        mode="contained"
        disabled={busy || (!applyTitle && !applyDescription)}
        loading={busy}
        style={{ marginTop: spacing.lg }}
        onPress={() => void onAccept(false)}
      >
        {t('business.rentals.aiProposal.applySelected', 'Apply selected & publish')}
      </Button>
      <Button
        mode="outlined"
        disabled={busy}
        style={{ marginTop: spacing.sm }}
        onPress={() => void onAccept(true)}
      >
        {t('business.rentals.aiProposal.publishAsIs', 'Publish without changes')}
      </Button>
      <Button
        mode="text"
        disabled={busy}
        textColor={colors.text.secondary}
        style={{ marginTop: spacing.sm }}
        onPress={() => void onDecline()}
      >
        {t('business.rentals.aiProposal.decline', 'Decline & resubmit for AI review')}
      </Button>
      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginTop: spacing.sm },
        ]}
      >
        {t(
          'business.rentals.aiProposal.actionsHint',
          '"Publish without changes" publishes the listing exactly as you wrote it. Declining sends it back for another AI review.'
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
});
