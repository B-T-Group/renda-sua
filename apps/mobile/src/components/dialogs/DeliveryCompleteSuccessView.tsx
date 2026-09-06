import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Text, TextInput } from 'react-native-paper';
import { StarRatingInput } from '../common/StarRatingInput';
import { QuickCommentChips } from '../rating/QuickCommentChips';
import { SuccessDeliveryVector } from '../feedback/SuccessDeliveryVector';
import { useTheme } from '../../contexts/ThemeContext';
import type { QuickCommentDef } from '../../utils/ratingQuickComments';

export interface DeliveryCompleteSuccessViewProps {
  animToken: number;
  orderNumber: string;
  clientName: string;
  stars: number;
  onStarsChange: (n: number) => void;
  quickComments: QuickCommentDef[];
  selectedIds: string[];
  onToggleChip: (id: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  submitError: string | null;
  submitting: boolean;
  insetTop: number;
  insetBottom: number;
  onClose: () => void;
  onSubmit: () => void;
}

function SuccessHeader({
  animToken,
  orderNumber,
  submitting,
  insetTop,
  onClose,
}: Pick<
  DeliveryCompleteSuccessViewProps,
  'animToken' | 'orderNumber' | 'submitting' | 'insetTop' | 'onClose'
>) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insetTop + spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.sm,
          borderBottomColor: colors.divider,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.headerBar}>
        <IconButton
          icon="close"
          onPress={onClose}
          disabled={submitting}
          accessibilityLabel={t('common.close', 'Close')}
        />
      </View>
      <SuccessDeliveryVector playToken={animToken} size={80} />
      <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
        {t('orders.deliverySuccess.title', 'Delivery complete')}
      </Text>
      <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.text.secondary }]}>
        {t('orders.deliverySuccess.subtitle', 'Order #{{orderNumber}} has been marked as delivered.', {
          orderNumber,
        })}
      </Text>
    </View>
  );
}

function ClientRatingCard({
  clientName,
  stars,
  onStarsChange,
  quickComments,
  selectedIds,
  onToggleChip,
  comment,
  onCommentChange,
  submitError,
  submitting,
}: Pick<
  DeliveryCompleteSuccessViewProps,
  | 'clientName'
  | 'stars'
  | 'onStarsChange'
  | 'quickComments'
  | 'selectedIds'
  | 'onToggleChip'
  | 'comment'
  | 'onCommentChange'
  | 'submitError'
  | 'submitting'
>) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const hint = clientName
    ? t('orders.deliverySuccess.rateClientHintNamed', 'How was your experience with {{name}}?', {
        name: clientName,
      })
    : t('orders.deliverySuccess.rateClientHint', 'How was your experience with this client?');

  return (
    <View
      style={[
        styles.rateCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.card,
          padding: spacing.md,
        },
      ]}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: spacing.xxs }}>
        {t('orders.deliverySuccess.rateClientTitle', 'Rate the client')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {hint}
      </Text>
      <StarRatingInput value={stars} onChange={onStarsChange} disabled={submitting} size={40} />
      {quickComments.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
            {t('orders.deliverySuccess.quickComments.label', 'Quick comments')}
          </Text>
          <QuickCommentChips
            comments={quickComments}
            selectedIds={selectedIds}
            onToggle={onToggleChip}
            disabled={submitting}
          />
        </View>
      ) : null}
      <TextInput
        mode="outlined"
        label={t('orders.deliverySuccess.commentLabel', 'Additional comment (optional)')}
        value={comment}
        onChangeText={onCommentChange}
        multiline
        numberOfLines={3}
        disabled={submitting}
        style={{ marginTop: spacing.md }}
      />
      {submitError ? (
        <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.xs }}>
          {submitError}
        </Text>
      ) : null}
    </View>
  );
}

function SuccessFooter({
  stars,
  submitting,
  insetBottom,
  onClose,
  onSubmit,
}: Pick<
  DeliveryCompleteSuccessViewProps,
  'stars' | 'submitting' | 'insetBottom' | 'onClose' | 'onSubmit'
>) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: Math.max(insetBottom, spacing.md),
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          borderTopColor: colors.divider,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Button
        mode="contained"
        onPress={onSubmit}
        loading={submitting}
        disabled={stars < 1 || submitting}
        style={styles.primaryBtn}
      >
        {t('orders.deliverySuccess.submitRating', 'Submit rating')}
      </Button>
      <Button mode="text" onPress={onClose} disabled={submitting} style={{ marginTop: spacing.xxs }}>
        {t('orders.deliverySuccess.skipRating', 'Skip')}
      </Button>
    </View>
  );
}

export function DeliveryCompleteSuccessView(props: DeliveryCompleteSuccessViewProps) {
  const { spacing } = useTheme();
  return (
    <>
      <SuccessHeader
        animToken={props.animToken}
        orderNumber={props.orderNumber}
        submitting={props.submitting}
        insetTop={props.insetTop}
        onClose={props.onClose}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ClientRatingCard
          clientName={props.clientName}
          stars={props.stars}
          onStarsChange={props.onStarsChange}
          quickComments={props.quickComments}
          selectedIds={props.selectedIds}
          onToggleChip={props.onToggleChip}
          comment={props.comment}
          onCommentChange={props.onCommentChange}
          submitError={props.submitError}
          submitting={props.submitting}
        />
      </ScrollView>
      <SuccessFooter
        stars={props.stars}
        submitting={props.submitting}
        insetBottom={props.insetBottom}
        onClose={props.onClose}
        onSubmit={props.onSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerBar: { alignSelf: 'stretch', alignItems: 'flex-end' },
  title: { textAlign: 'center', fontWeight: '700', marginTop: 4 },
  subtitle: { textAlign: 'center', marginTop: 4, marginBottom: 8, paddingHorizontal: 16 },
  scroll: { flex: 1 },
  rateCard: { borderWidth: StyleSheet.hairlineWidth },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { alignSelf: 'stretch' },
});
