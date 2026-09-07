import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusPill } from '../../components/common/StatusPill';
import { ImageLightbox } from '../../components/common/ImageLightbox';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessReferralReviewScreen } from '../../hooks/useBusinessReferralReviewScreen';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type {
  ItemQualityMark,
  ReferralReviewItem,
} from '../../types/businessReferralReview';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'BusinessReferralReview'
>;

function reviewStatusLabel(
  status: string,
  isPaid: boolean,
  t: (k: string, d: string) => string
): string {
  if (isPaid) return t('admin.referralReview.status.paid', 'Paid');
  if (status === 'approved') {
    return t('admin.referralReview.status.approved', 'Approved');
  }
  if (status === 'rejected') {
    return t('admin.referralReview.status.rejected', 'Rejected');
  }
  return t('admin.referralReview.status.pending', 'Pending review');
}

function ReviewItemCard({
  item,
  mark,
  onMark,
  onOpenImages,
  disabled,
}: {
  item: ReferralReviewItem;
  mark: ItemQualityMark | null;
  onMark: (q: ItemQualityMark) => void;
  onOpenImages: (index: number) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const thumb = item.images[0]?.imageUrl;

  return (
    <View
      style={[
        styles.itemCard,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.itemHeader}
      >
        <Pressable
          onPress={() => item.images.length > 0 && onOpenImages(0)}
          disabled={item.images.length === 0}
        >
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} />
          ) : (
            <View
              style={[
                styles.thumb,
                { backgroundColor: colors.pageBackground },
              ]}
            />
          )}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.sm }}>
          <Text
            style={[typography.subheading, { color: colors.text.primary }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            {item.price != null
              ? `${item.price} ${item.currency ?? ''}`.trim()
              : '—'}
            {' · '}
            {item.moderationStatus}
          </Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ marginTop: spacing.sm }}>
          {item.description ? (
            <Text
              style={[typography.body2, { color: colors.text.secondary }]}
            >
              {item.description}
            </Text>
          ) : null}
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, marginTop: spacing.xs },
            ]}
          >
            {t('admin.referralReview.itemMeta', 'Status: {{status}} · Active: {{active}}', {
              status: item.status,
              active: item.isActive ? 'yes' : 'no',
            })}
          </Text>
          {item.inventory.map((inv) => (
            <Text
              key={inv.id}
              style={[typography.caption, { color: colors.text.secondary }]}
            >
              {inv.locationName ?? '—'} · qty {inv.quantity}
            </Text>
          ))}
          {item.images.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.sm }}
            >
              {item.images.map((img, idx) => (
                <Pressable
                  key={img.id}
                  onPress={() => onOpenImages(idx)}
                  style={{ marginRight: spacing.xs }}
                >
                  <Image
                    source={{ uri: img.imageUrl }}
                    style={styles.galleryThumb}
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.markRow, { marginTop: spacing.sm }]}>
        <Button
          mode={mark === 'good' ? 'contained' : 'outlined'}
          compact
          disabled={disabled}
          onPress={() => onMark('good')}
          style={{ flex: 1, marginRight: spacing.xs }}
        >
          {t('admin.referralReview.good', 'Good')}
        </Button>
        <Button
          mode={mark === 'bad' ? 'contained' : 'outlined'}
          compact
          disabled={disabled}
          buttonColor={mark === 'bad' ? colors.error.main : undefined}
          onPress={() => onMark('bad')}
          style={{ flex: 1 }}
        >
          {t('admin.referralReview.bad', 'Bad')}
        </Button>
      </View>
    </View>
  );
}

export default function BusinessReferralReviewScreen({ route }: Props) {
  const { businessId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const screen = useBusinessReferralReviewScreen(businessId);
  const [lightbox, setLightbox] = useState<{
    images: Array<{ id?: string; image_url: string }>;
    index: number;
  } | null>(null);

  const agentName = useMemo(() => {
    if (!screen.detail) return '';
    const a = screen.detail.agent;
    return `${a.firstName} ${a.lastName}`.trim() || a.agentCode || a.agentId;
  }, [screen.detail]);

  if (screen.loading && !screen.detail) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (!screen.detail) {
    return (
      <View style={[styles.center, { padding: spacing.lg }]}>
        <Text style={{ color: colors.error.main }}>
          {screen.error ??
            t('admin.referralReview.loadError', 'Could not load review')}
        </Text>
        <Button onPress={() => void screen.reload()} style={{ marginTop: spacing.md }}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const detail = screen.detail;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: 120 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={screen.loading}
            onRefresh={() => void screen.reload()}
          />
        }
      >
        <View
          style={[
            styles.headerCard,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.headerTop}>
            <Text
              style={[
                typography.subheading,
                { color: colors.text.primary, flex: 1, minWidth: 0 },
              ]}
              numberOfLines={2}
            >
              {detail.businessName}
            </Text>
            <StatusPill
              compact
              label={reviewStatusLabel(
                detail.payoutReviewStatus,
                detail.isPaid,
                t
              )}
            />
          </View>
          <Text
            style={[typography.body2, { color: colors.text.secondary }]}
          >
            {t('admin.referralReview.agentLine', 'Agent: {{name}} ({{code}})', {
              name: agentName,
              code: detail.agent.agentCode ?? '—',
            })}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, marginTop: 4 },
            ]}
          >
            {t(
              'admin.referralReview.counts',
              '{{items}} items · {{good}} good · {{bad}} bad',
              {
                items: detail.items.length,
                good: screen.goodCount,
                bad: screen.badCount,
              }
            )}
          </Text>
          {detail.payoutReviewStatus === 'rejected' && detail.rejectionReason ? (
            <Text
              style={[
                typography.body2,
                { color: colors.error.main, marginTop: spacing.sm },
              ]}
            >
              {detail.rejectionReason}
            </Text>
          ) : null}
          {screen.locked ? (
            <Text
              style={[
                typography.caption,
                { color: colors.warning.dark, marginTop: spacing.sm },
              ]}
            >
              {t(
                'admin.referralReview.locked',
                'Already paid — review is locked.'
              )}
            </Text>
          ) : null}
        </View>

        {detail.items.map((item) => (
          <ReviewItemCard
            key={item.id}
            item={item}
            mark={screen.marks[item.id] ?? null}
            disabled={screen.locked || screen.submitting}
            onMark={(q) => screen.setItemMark(item.id, q)}
            onOpenImages={(index) =>
              setLightbox({
                index,
                images: item.images.map((img) => ({
                  id: img.id,
                  image_url: img.imageUrl,
                })),
              })
            }
          />
        ))}
      </ScrollView>

      {!screen.locked ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.sm,
              paddingTop: spacing.sm,
              paddingHorizontal: spacing.md,
              borderTopColor: colors.divider,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {screen.softWarnApprove ? (
            <Text
              style={[
                typography.caption,
                { color: colors.warning.dark, marginBottom: spacing.xs },
              ]}
            >
              {t(
                'admin.referralReview.softWarn',
                'Fewer than {{n}} items marked good. You can still approve.',
                { n: screen.goldenTarget }
              )}
            </Text>
          ) : null}
          {screen.error && screen.error !== 'rejection_required' ? (
            <Text
              style={[
                typography.caption,
                { color: colors.error.main, marginBottom: spacing.xs },
              ]}
            >
              {screen.error}
            </Text>
          ) : null}
          <View style={styles.footerActions}>
            <Button
              mode="outlined"
              disabled={screen.submitting}
              onPress={() => screen.setRejectVisible(true)}
              style={{ flex: 1, marginRight: spacing.sm }}
            >
              {t('admin.referralReview.reject', 'Reject')}
            </Button>
            <Button
              mode="contained"
              loading={screen.submitting}
              disabled={screen.submitting}
              onPress={() => void screen.submitApprove()}
              style={{ flex: 1 }}
            >
              {t('admin.referralReview.approve', 'Approve')}
            </Button>
          </View>
        </View>
      ) : null}

      <Modal
        visible={screen.rejectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => screen.setRejectVisible(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.scrim}
          onPress={() => screen.setRejectVisible(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              shadows.md,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.xl,
                maxHeight: height * 0.85,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={[
                typography.subheading,
                {
                  color: colors.text.primary,
                  padding: spacing.md,
                },
              ]}
            >
              {t('admin.referralReview.rejectTitle', 'Reject referral payout')}
            </Text>
            <Text
              style={[
                typography.body2,
                {
                  color: colors.text.secondary,
                  paddingHorizontal: spacing.md,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              {t(
                'admin.referralReview.rejectBody',
                'The referring agent will see this reason.'
              )}
            </Text>
            <TextInput
              mode="outlined"
              multiline
              value={screen.rejectReason}
              onChangeText={screen.setRejectReason}
              placeholder={t(
                'admin.referralReview.rejectPlaceholder',
                'Reason for rejection'
              )}
              style={{ marginHorizontal: spacing.md, minHeight: 100 }}
            />
            {screen.error === 'rejection_required' ? (
              <Text
                style={{
                  color: colors.error.main,
                  marginHorizontal: spacing.md,
                  marginTop: spacing.xs,
                }}
              >
                {t(
                  'admin.referralReview.rejectionRequired',
                  'A rejection reason is required.'
                )}
              </Text>
            ) : null}
            <View
              style={[
                styles.footerActions,
                { padding: spacing.md, marginTop: spacing.sm },
              ]}
            >
              <Button
                mode="text"
                onPress={() => screen.setRejectVisible(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                loading={screen.submitting}
                disabled={screen.submitting}
                onPress={() => void screen.submitReject()}
              >
                {t('admin.referralReview.confirmReject', 'Confirm reject')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ImageLightbox
        visible={lightbox != null}
        images={lightbox?.images ?? []}
        index={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onIndexChange={(index) =>
          setLightbox((prev) => (prev ? { ...prev, index } : null))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { borderWidth: 1 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  itemCard: { borderWidth: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  galleryThumb: { width: 72, height: 72, borderRadius: 8 },
  markRow: { flexDirection: 'row' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%' },
});
