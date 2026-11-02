import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';
import { ConfirmActionDialog } from '@/components/dialogs/ConfirmActionDialog';
import { NeedsChangesIllustration } from '@/components/illustrations/NeedsChangesIllustration';
import { ProductPhotoTipsIllustration } from '@/components/illustrations/ProductPhotoTipsIllustration';
import type {
  ItemAppeal,
  ItemCondition,
  ItemRejectionRecovery,
} from '@/types/itemRejectionRecovery';
import type { AppealTileDisabledReason } from '@/types/itemRejectionRecovery';
import {
  categoryDefaultLabel,
  categoryLabelKey,
  parseRejectionCategory,
  validateAppealReason,
  validateWearNote,
} from '@/utils/itemRejectionRecovery';
import { RecoveryActionTiles, type RecoveryTileId } from './RecoveryActionTiles';
import { RecoverySheet } from './RecoverySheet';

type Photo = { id: string; image_url: string };

type Props = {
  recovery: ItemRejectionRecovery;
  photos: Photo[];
  locked?: boolean;
  hasLocalChanges?: boolean;
  canResubmit?: boolean;
  warnAppealWithdraw?: boolean;
  appealDisabledReason?: AppealTileDisabledReason;
  busy?: boolean;
  onAction: (id: RecoveryTileId) => void;
  onResubmit: (confirmWithdraw: boolean) => Promise<void>;
  onSaveCondition: (condition: ItemCondition, wearNote: string) => Promise<void>;
  onSubmitAppeal: (reason: string) => Promise<void>;
  onAddEvidence: () => Promise<void>;
  evidenceLabels: string[];
  onRetakeCamera: (replaceId: string | null) => Promise<void>;
  onRetakeLibrary: (replaceId: string | null) => Promise<void>;
  onBuyTokens: () => void;
  onRunAiFix: (imageIds: string[]) => Promise<void>;
  compare?: { originalUrl: string; enhancedUrl: string; altered: boolean } | null;
  onKeepAiFix: () => Promise<void>;
  onDiscardAiFix: () => Promise<void>;
  onTranslate?: (text: string) => Promise<string | null>;
  translationAvailable?: boolean;
  selectedAiIds: string[];
  onToggleAiId: (id: string) => void;
  aiCostLabel: string;
  needsBuyTokens: boolean;
};

export function NeedsChangesCard(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [dialog, setDialog] = useState<RecoveryTileId | 'resubmit' | null>(null);
  const category = parseRejectionCategory(props.recovery.rejection?.category);

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          marginBottom: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background.paper,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.divider,
        },
      ]}
    >
      <View style={styles.header}>
        <NeedsChangesIllustration category={category} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleSmall">
            {t(categoryLabelKey(category), categoryDefaultLabel(category))}
          </Text>
          {props.recovery.rejection?.reason ? (
            <ReasonText
              text={props.recovery.rejection.reason}
              translationAvailable={props.translationAvailable}
              onTranslate={props.onTranslate}
            />
          ) : null}
          <Text variant="labelSmall" style={{ color: colors.text.secondary, marginTop: 6 }}>
            {t('business.items.recovery.tokensUsed', {
              n: props.recovery.aiCleanup.tokensSpentOnItem,
              defaultValue: `Tokens used on this item: ${props.recovery.aiCleanup.tokensSpentOnItem}`,
            })}
          </Text>
        </View>
      </View>
      {props.recovery.appeal && props.recovery.appeal.status !== 'withdrawn' ? (
        <AppealTimeline appeal={props.recovery.appeal} />
      ) : null}
      <RecoveryActionTiles
        actions={props.recovery.actions}
        resubmitEditLink={props.recovery.resubmitEditLink}
        locked={props.locked}
        appealDisabledReason={props.appealDisabledReason}
        onAction={(id) => {
          if (id === 'edit_fields' || id === 'edit_price') {
            props.onAction(id);
            return;
          }
          setDialog(id);
        }}
      />
      {props.canResubmit ? (
        <Button
          mode="contained"
          disabled={props.locked || props.busy}
          style={{ marginTop: spacing.md }}
          onPress={() => setDialog('resubmit')}
        >
          {t('business.items.recovery.action.resubmit', 'Resubmit for review')}
        </Button>
      ) : null}
      <CardSheets dialog={dialog} onClose={() => setDialog(null)} {...props} />
    </View>
  );
}

function ReasonText({
  text,
  translationAvailable,
  onTranslate,
}: {
  text: string;
  translationAvailable?: boolean;
  onTranslate?: (text: string) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [translated, setTranslated] = useState<string | null>(null);
  return (
    <View>
      <Text variant="bodyMedium" style={{ color: colors.text.primary, marginTop: 4 }}>
        {translated ?? text}
      </Text>
      {translationAvailable && onTranslate ? (
        <Button
          compact
          onPress={() => {
            if (translated) {
              setTranslated(null);
              return;
            }
            void onTranslate(text).then((next) => {
              if (next) setTranslated(next);
            });
          }}
        >
          {translated
            ? t('business.items.recovery.showOriginal', 'Show original')
            : t('business.items.recovery.translate', 'Translate')}
        </Button>
      ) : null}
    </View>
  );
}

function AppealTimeline({ appeal }: { appeal: ItemAppeal }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const steps = [
    { id: 'pending', label: t('business.items.recovery.appeal.pending', 'Appeal pending'), on: appeal.status === 'pending' },
    { id: 'upheld', label: t('business.items.recovery.appeal.upheld', 'Decision upheld'), on: appeal.status === 'upheld' },
    { id: 'overturned', label: t('business.items.recovery.appeal.overturned', 'Decision overturned, your item is live'), on: appeal.status === 'overturned' },
  ];
  return (
    <View style={{ marginVertical: 8, gap: 6 }}>
      {steps.map((step) => (
        <Text key={step.id} variant="labelSmall" style={{ color: step.on ? colors.warning.dark : colors.text.secondary }}>
          {step.label}
        </Text>
      ))}
      {appeal.adminNote ? (
        <Text variant="bodySmall">{appeal.adminNote}</Text>
      ) : null}
    </View>
  );
}

function CardSheets(
  props: Props & { dialog: RecoveryTileId | 'resubmit' | null; onClose: () => void }
) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState<ItemCondition>(
    props.recovery.item.condition ?? 'new'
  );
  const [wearNote, setWearNote] = useState(props.recovery.item.wearNote ?? '');
  const [reason, setReason] = useState('');
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const wear = validateWearNote(condition, wearNote);
  const appealCheck = validateAppealReason(reason);
  const resubmitMessage = props.warnAppealWithdraw
    ? t('business.items.recovery.appeal.withdrawWarn', 'Resubmitting will withdraw your pending appeal.')
    : !props.hasLocalChanges
      ? t('business.items.recovery.resubmit.confirmNoChanges', 'Resubmit this item without more changes?')
      : t('business.items.recovery.resubmit.confirmTitle', 'Resubmit for review');

  return (
    <>
      <RecoverySheet
        visible={props.dialog === 'ai_fix'}
        title={t('business.items.recovery.action.aiFix', 'Fix photos with AI')}
        onClose={props.onClose}
        footer={
          props.needsBuyTokens ? (
            <Button mode="contained" onPress={props.onBuyTokens}>
              {t('business.items.recovery.aiFix.buy', 'Buy tokens')}
            </Button>
          ) : (
            <Button mode="contained" loading={props.busy} onPress={() => void props.onRunAiFix(props.selectedAiIds)}>
              {t('business.items.recovery.action.aiFix', 'Fix photos with AI')}
            </Button>
          )
        }
      >
        <Text>{t('business.items.recovery.aiFix.selectPhotos', 'Choose photos to fix')}</Text>
        {props.photos.map((photo, index) => (
          <Button
            key={photo.id}
            mode={props.selectedAiIds.includes(photo.id) ? 'contained-tonal' : 'outlined'}
            onPress={() => props.onToggleAiId(photo.id)}
          >
            {`${t('business.items.recovery.retake.photo', 'Photo')} ${index + 1}`}
          </Button>
        ))}
        <Text>{props.aiCostLabel}</Text>
        {props.compare ? (
          <CompareSwipe
            compare={props.compare}
            onKeep={props.onKeepAiFix}
            onDiscard={props.onDiscardAiFix}
          />
        ) : null}
      </RecoverySheet>
      <RecoverySheet
        visible={props.dialog === 'retake'}
        title={t('business.items.recovery.action.retake', 'Retake photo')}
        onClose={props.onClose}
      >
        <ProductPhotoTipsIllustration size={140} />
        <Text>{t('business.items.recovery.retake.tips', 'Use daylight, a plain background, and show any wear.')}</Text>
        <Button mode="contained" icon="camera" onPress={() => void props.onRetakeCamera(replaceId)}>
          {t('business.items.recovery.retake.camera', 'Take photo')}
        </Button>
        <Button mode="outlined" onPress={() => void props.onRetakeLibrary(replaceId)}>
          {t('business.items.recovery.retake.library', 'Choose from library')}
        </Button>
        {props.photos[0] ? (
          <Button onPress={() => setReplaceId(props.photos[0].id)}>
            {t('business.items.recovery.retake.replace', 'Replace photo')}
          </Button>
        ) : null}
      </RecoverySheet>
      <RecoverySheet
        visible={props.dialog === 'condition'}
        title={t('business.items.recovery.action.condition', 'Change condition')}
        onClose={props.onClose}
        footer={
          <Button
            mode="contained"
            disabled={!wear.valid || props.busy}
            onPress={() => void props.onSaveCondition(condition, wearNote)}
          >
            {t('business.items.recovery.condition.save', 'Save condition')}
          </Button>
        }
      >
        {(['new', 'used', 'refurbished'] as ItemCondition[]).map((value) => (
          <Button
            key={value}
            mode={condition === value ? 'contained-tonal' : 'outlined'}
            onPress={() => setCondition(value)}
          >
            {t(
              `business.items.recovery.condition.${value === 'refurbished' ? 'refurb' : value}`,
              value
            )}
          </Button>
        ))}
        {condition !== 'new' ? (
          <TextInput
            mode="outlined"
            multiline
            value={wearNote}
            onChangeText={setWearNote}
            label={t('business.items.recovery.condition.wearNote', 'Describe the wear')}
            error={!wear.valid && wearNote.length > 0}
          />
        ) : null}
      </RecoverySheet>
      <RecoverySheet
        visible={props.dialog === 'appeal'}
        title={t('business.items.recovery.action.appeal', 'Appeal decision')}
        onClose={props.onClose}
        footer={
          <Button
            mode="contained"
            disabled={!appealCheck.valid || props.busy}
            onPress={() => void props.onSubmitAppeal(reason.trim())}
          >
            {t('business.items.recovery.appeal.submit', 'Submit appeal')}
          </Button>
        }
      >
        <Text>{t('business.items.recovery.appeal.limit', '1 appeal per decision')}</Text>
        <TextInput
          mode="outlined"
          multiline
          value={reason}
          onChangeText={setReason}
          label={t('business.items.recovery.appeal.reason', 'Why should we reconsider?')}
        />
        <Button mode="outlined" onPress={() => void props.onAddEvidence()}>
          {t('business.items.recovery.appeal.evidence', 'Add evidence (optional)')}
        </Button>
        {props.evidenceLabels.map((label) => (
          <Text key={label} variant="labelSmall">{label}</Text>
        ))}
      </RecoverySheet>
      <ConfirmActionDialog
        visible={props.dialog === 'resubmit'}
        title={t('business.items.recovery.action.resubmit', 'Resubmit for review')}
        message={resubmitMessage}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('business.items.recovery.action.resubmit', 'Resubmit for review')}
        loading={props.busy}
        onDismiss={props.onClose}
        onConfirm={() => void props.onResubmit(Boolean(props.warnAppealWithdraw))}
      />
    </>
  );
}

function CompareSwipe({
  compare,
  onKeep,
  onDiscard,
}: {
  compare: { originalUrl: string; enhancedUrl: string; altered: boolean };
  onKeep: () => Promise<void>;
  onDiscard: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <View>
      {compare.altered ? (
        <Text>
          {t(
            'business.items.recovery.aiFix.altered',
            'AI may have changed the item itself. Check carefully.'
          )}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Image source={{ uri: compare.originalUrl }} style={styles.compare} contentFit="cover" />
        <Image source={{ uri: compare.enhancedUrl }} style={styles.compare} contentFit="cover" />
      </View>
      <Button mode={compare.altered ? 'contained' : 'outlined'} onPress={() => void onDiscard()}>
        {t('business.items.recovery.aiFix.discard', 'Discard')}
      </Button>
      <Button mode={compare.altered ? 'outlined' : 'contained'} onPress={() => void onKeep()}>
        {t('business.items.recovery.aiFix.keep', 'Keep')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  compare: { width: 140, height: 140, borderRadius: 8 },
});
