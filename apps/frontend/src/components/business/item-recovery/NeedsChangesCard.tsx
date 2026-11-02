import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemImage } from '../../../types/image';
import type {
  ItemCondition,
  ItemRejectionRecovery,
  RejectionCategory,
} from '../../../types/itemRejectionRecovery';
import type { AppealTileDisabledReason } from '../../../types/itemRejectionRecovery';
import {
  categoryDefaultLabel,
  categoryLabelKey,
  parseRejectionCategory,
} from '../../../utils/itemRejectionRecovery';
import ConfirmationModal from '../../common/ConfirmationModal';
import { NeedsChangesIllustration } from '../../illustrations/NeedsChangesIllustration';
import { AiFixPhotosDialog } from './AiFixPhotosDialog';
import { AppealDecisionDialog } from './AppealDecisionDialog';
import { AppealTimeline } from './AppealTimeline';
import { ChangeConditionDialog } from './ChangeConditionDialog';
import { RecoveryActionTiles } from './RecoveryActionTiles';
import type { RecoveryTileId } from './recoveryActionMeta';
import { RejectionReasonBlock } from './RejectionReasonBlock';
import { RetakePhotoDialog } from './RetakePhotoDialog';

type Props = {
  recovery: ItemRejectionRecovery;
  images: ItemImage[];
  locked?: boolean;
  hasLocalChanges?: boolean;
  canResubmit?: boolean;
  warnAppealWithdraw?: boolean;
  appealDisabledReason?: AppealTileDisabledReason;
  translationAvailable?: boolean;
  busy?: boolean;
  onAction: (id: RecoveryTileId) => void;
  onResubmit: (confirmWithdraw: boolean) => Promise<void>;
  onSaveCondition: (condition: ItemCondition, wearNote: string) => Promise<void>;
  onSubmitAppeal: (reason: string, files: File[]) => Promise<void>;
  onRetake: (file: File, replaceImageId: string | null) => Promise<void>;
  onTranslate?: (text: string) => Promise<string | null>;
  onBuyTokens: () => void;
  onRunAiFix: (
    imageIds: string[]
  ) => Promise<{
    resultId: string;
    originalUrl: string;
    enhancedUrl: string;
    altered: boolean;
  } | null>;
  onKeepAiFix: (resultId: string) => Promise<void>;
  onDiscardAiFix: (resultId: string) => Promise<void>;
};

export function NeedsChangesCard({
  recovery,
  images,
  locked,
  hasLocalChanges,
  canResubmit,
  warnAppealWithdraw,
  appealDisabledReason,
  translationAvailable,
  busy,
  onAction,
  onResubmit,
  onSaveCondition,
  onSubmitAppeal,
  onRetake,
  onTranslate,
  onBuyTokens,
  onRunAiFix,
  onKeepAiFix,
  onDiscardAiFix,
}: Props) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<RecoveryTileId | 'resubmit' | null>(null);
  const category = parseRejectionCategory(recovery.rejection?.category);
  const photos = useMemo(
    () => images.map((image) => ({ id: image.id, image_url: image.image_url })),
    [images]
  );

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: categoryTone(category),
        bgcolor: 'background.paper',
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <NeedsChangesIllustration category={category} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t(categoryLabelKey(category), categoryDefaultLabel(category))}
            </Typography>
            {recovery.rejection?.reason ? (
              <RejectionReasonBlock
                text={recovery.rejection.reason}
                translationAvailable={translationAvailable}
                onTranslate={onTranslate}
              />
            ) : null}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('business.items.recovery.tokensUsed', {
                n: recovery.aiCleanup.tokensSpentOnItem,
                defaultValue: `Tokens used on this item: ${recovery.aiCleanup.tokensSpentOnItem}`,
              })}
            </Typography>
          </Box>
        </Stack>
        {recovery.appeal && recovery.appeal.status !== 'withdrawn' ? (
          <AppealTimeline
            appeal={recovery.appeal}
            translationAvailable={translationAvailable}
            onTranslate={onTranslate}
          />
        ) : null}
        <Box sx={{ mt: 2 }}>
          <RecoveryActionTiles
            actions={recovery.actions}
            resubmitEditLink={recovery.resubmitEditLink}
            locked={locked}
            appealDisabledReason={appealDisabledReason}
            onAction={(id) => {
              if (id === 'edit_fields' || id === 'edit_price') {
                onAction(id);
                return;
              }
              setDialog(id);
            }}
          />
        </Box>
        {canResubmit ? (
          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 2, position: { md: 'sticky' }, bottom: 8 }}
            disabled={locked || busy}
            onClick={() => setDialog('resubmit')}
          >
            {t('business.items.recovery.action.resubmit', 'Resubmit for review')}
          </Button>
        ) : null}
      </CardContent>
      <CardDialogs
        dialog={dialog}
        recovery={recovery}
        photos={photos}
        busy={busy}
        hasLocalChanges={hasLocalChanges}
        warnAppealWithdraw={warnAppealWithdraw}
        onClose={() => setDialog(null)}
        onResubmit={onResubmit}
        onSaveCondition={onSaveCondition}
        onSubmitAppeal={onSubmitAppeal}
        onRetake={onRetake}
        onBuyTokens={onBuyTokens}
        onRunAiFix={onRunAiFix}
        onKeepAiFix={onKeepAiFix}
        onDiscardAiFix={onDiscardAiFix}
      />
    </Card>
  );
}

function categoryTone(category: RejectionCategory): string {
  return category === 'prohibited_item' || category === 'counterfeit'
    ? 'error.light'
    : 'warning.light';
}

function CardDialogs({
  dialog,
  recovery,
  photos,
  busy,
  hasLocalChanges,
  warnAppealWithdraw,
  onClose,
  onResubmit,
  onSaveCondition,
  onSubmitAppeal,
  onRetake,
  onBuyTokens,
  onRunAiFix,
  onKeepAiFix,
  onDiscardAiFix,
}: {
  dialog: RecoveryTileId | 'resubmit' | null;
  recovery: ItemRejectionRecovery;
  photos: Array<{ id: string; image_url: string }>;
  busy?: boolean;
  hasLocalChanges?: boolean;
  warnAppealWithdraw?: boolean;
  onClose: () => void;
  onResubmit: (confirmWithdraw: boolean) => Promise<void>;
  onSaveCondition: (condition: ItemCondition, wearNote: string) => Promise<void>;
  onSubmitAppeal: (reason: string, files: File[]) => Promise<void>;
  onRetake: (file: File, replaceImageId: string | null) => Promise<void>;
  onBuyTokens: () => void;
  onRunAiFix: Props['onRunAiFix'];
  onKeepAiFix: Props['onKeepAiFix'];
  onDiscardAiFix: Props['onDiscardAiFix'];
}) {
  const { t } = useTranslation();
  const resubmitMessage = warnAppealWithdraw
    ? t(
        'business.items.recovery.appeal.withdrawWarn',
        'Resubmitting will withdraw your pending appeal.'
      )
    : !hasLocalChanges
      ? t(
          'business.items.recovery.resubmit.confirmNoChanges',
          'Resubmit this item without more changes?'
        )
      : t(
          'business.items.recovery.resubmit.confirmTitle',
          'Resubmit for review'
        );

  return (
    <>
      <AiFixPhotosDialog
        open={dialog === 'ai_fix'}
        images={photos}
        balance={recovery.aiCleanup.tokenBalance}
        costPerImage={recovery.aiCleanup.costPerImage}
        running={busy}
        onClose={onClose}
        onBuyTokens={onBuyTokens}
        onRun={onRunAiFix}
        onKeep={onKeepAiFix}
        onDiscard={onDiscardAiFix}
      />
      <RetakePhotoDialog
        open={dialog === 'retake'}
        photos={photos}
        uploading={busy}
        onClose={onClose}
        onPickFile={async (file, replaceId) => {
          await onRetake(file, replaceId);
          onClose();
        }}
      />
      <ChangeConditionDialog
        open={dialog === 'condition'}
        initialCondition={recovery.item.condition ?? 'new'}
        initialWearNote={recovery.item.wearNote}
        saving={busy}
        onClose={onClose}
        onSave={async (condition, wearNote) => {
          await onSaveCondition(condition, wearNote);
          onClose();
        }}
      />
      <AppealDecisionDialog
        open={dialog === 'appeal'}
        submitting={busy}
        onClose={onClose}
        onSubmit={async (reason, files) => {
          await onSubmitAppeal(reason, files);
          onClose();
        }}
      />
      <ConfirmationModal
        open={dialog === 'resubmit'}
        title={t('business.items.recovery.action.resubmit', 'Resubmit for review')}
        message={resubmitMessage}
        loading={busy}
        onCancel={onClose}
        onConfirm={() => void onResubmit(Boolean(warnAppealWithdraw))}
      />
    </>
  );
}
