import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../contexts/UserProfileContext';
import { useAiImageCleanup } from '../../../hooks/useAiImageCleanup';
import { useItemImages } from '../../../hooks/useItemImages';
import { useItemRejectionRecovery } from '../../../hooks/useItemRejectionRecovery';
import type { Item } from '../../../hooks/useItems';
import type { ItemCondition } from '../../../types/itemRejectionRecovery';
import {
  isAlteredCleanup,
  isInsufficientTokensError,
} from '../../../utils/itemRejectionRecovery';
import { NeedsChangesCard } from './NeedsChangesCard';
import type { RecoveryTileId } from './recoveryActionMeta';

type Props = {
  item: Item;
  onItemUpdated: () => Promise<unknown> | void;
  onEdit: () => void;
};

export function ItemRecoverySection({ item, onItemUpdated, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, updateBusinessAiTokens } = useUserProfileContext();
  const { uploadItemImage, deleteItemImage } = useItemImages();
  const cleanup = useAiImageCleanup();
  const [busy, setBusy] = useState(false);
  const recoveryApi = useItemRejectionRecovery(item.id);

  if (!recoveryApi.visible || !recoveryApi.recovery) return null;

  return (
    <NeedsChangesCard
      recovery={recoveryApi.recovery}
      images={item.item_images ?? []}
      locked={recoveryApi.locked}
      hasLocalChanges={recoveryApi.hasLocalChanges}
      canResubmit={recoveryApi.canResubmit}
      warnAppealWithdraw={recoveryApi.warnAppealWithdraw}
      appealDisabledReason={recoveryApi.appealDisabledReason}
      translationAvailable={Boolean(item.translation_available)}
      busy={busy}
      onAction={(id) => handleNavAction(id, onEdit)}
      onResubmit={async (confirmWithdraw) => {
        await runBusy(setBusy, () => recoveryApi.submitResubmit(confirmWithdraw));
        await onItemUpdated();
      }}
      onSaveCondition={async (condition, wearNote) => {
        await saveCondition(recoveryApi.saveCondition, condition, wearNote);
        recoveryApi.markChanged();
        await onItemUpdated();
      }}
      onSubmitAppeal={async (reason, files) => {
        await submitAppealWithFiles(recoveryApi, reason, files);
        await onItemUpdated();
      }}
      onRetake={async (file, replaceImageId) => {
        await retakePhoto({
          item,
          file,
          replaceImageId,
          userId: profile?.id ?? '',
          uploadItemImage,
          deleteItemImage,
        });
        recoveryApi.markChanged();
        await onItemUpdated();
      }}
      onTranslate={async (text) => {
        const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
        const result = await recoveryApi.translateText(text, lang);
        return result.available ? result.text : null;
      }}
      onBuyTokens={() =>
        navigate(
          `/business/ai-tokens?returnTo=${encodeURIComponent(`/business/items/${item.id}?recovery=aiFix`)}`
        )
      }
      onRunAiFix={async (imageIds) =>
        runAiFix({
          itemId: item.id,
          imageIds,
          cleanup,
          updateBusinessAiTokens,
          enqueueSnackbar,
          t,
        })
      }
      onKeepAiFix={async (resultId) => {
        await cleanup.acceptResult(resultId);
        recoveryApi.markChanged();
        await onItemUpdated();
      }}
      onDiscardAiFix={async (resultId) => {
        await cleanup.rejectResult(resultId);
      }}
      onEvidenceExpired={() => void recoveryApi.reload()}
    />
  );
}

function handleNavAction(id: RecoveryTileId, onEdit: () => void) {
  if (id === 'edit_fields' || id === 'edit_price') onEdit();
}

async function runBusy(
  setBusy: (value: boolean) => void,
  work: () => Promise<unknown>
) {
  setBusy(true);
  try {
    await work();
  } finally {
    setBusy(false);
  }
}

async function saveCondition(
  save: (condition: ItemCondition, wearNote?: string | null) => Promise<unknown>,
  condition: ItemCondition,
  wearNote: string
) {
  await save(condition, wearNote);
}

async function submitAppealWithFiles(
  recoveryApi: ReturnType<typeof useItemRejectionRecovery>,
  reason: string,
  files: File[]
) {
  const keys: string[] = [];
  for (const file of files) {
    keys.push(await recoveryApi.uploadEvidence(file));
  }
  await recoveryApi.submitAppeal(reason, keys.filter(Boolean));
}

async function retakePhoto(input: {
  item: Item;
  file: File;
  replaceImageId: string | null;
  userId: string;
  uploadItemImage: ReturnType<typeof useItemImages>['uploadItemImage'];
  deleteItemImage: ReturnType<typeof useItemImages>['deleteItemImage'];
}) {
  const bucketName = process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';
  await input.uploadItemImage(
    input.item.id,
    input.item.business_id,
    input.file,
    input.userId,
    bucketName,
    input.item.name,
    undefined,
    input.replaceImageId ? 'gallery' : undefined
  );
  if (input.replaceImageId) {
    await input.deleteItemImage(input.replaceImageId);
  }
}

async function runAiFix(input: {
  itemId: string;
  imageIds: string[];
  cleanup: ReturnType<typeof useAiImageCleanup>;
  updateBusinessAiTokens: (tokens: number) => void;
  enqueueSnackbar: (msg: string, opts?: { variant?: string }) => void;
  t: (key: string, fallback: string) => string;
}) {
  try {
    const res = await input.cleanup.requestCleanup(input.itemId, input.imageIds);
    if (typeof res.data?.ai_tokens_remaining === 'number') {
      input.updateBusinessAiTokens(res.data.ai_tokens_remaining);
    }
    const jobId = res.data?.job.id;
    if (!jobId) return null;
    const job = await waitForJob(input.cleanup.getJob, jobId);
    const result = job?.results?.find((row) => row.cleaned_image_url);
    if (!result?.cleaned_image_url) return null;
    return {
      resultId: result.id,
      originalUrl: result.original_image_url,
      enhancedUrl: result.cleaned_image_url,
      altered: isAlteredCleanup(result),
    };
  } catch (error: unknown) {
    if (isInsufficientTokensError(error)) {
      input.enqueueSnackbar(
        input.t('business.items.recovery.aiFix.buy', 'Buy tokens'),
        { variant: 'warning' }
      );
      return null;
    }
    throw error;
  }
}

async function waitForJob(
  getJob: ReturnType<typeof useAiImageCleanup>['getJob'],
  jobId: string
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const job = await getJob(jobId);
    if (job?.results?.some((row) => row.cleaned_image_url)) return job;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return getJob(jobId);
}
