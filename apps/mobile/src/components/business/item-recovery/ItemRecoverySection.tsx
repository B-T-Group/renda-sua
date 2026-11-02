import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProfileMe } from '@/hooks/useProfileMe';
import { useItemRejectionRecovery } from '@/hooks/useItemRejectionRecovery';
import type { BusinessRootStackParamList } from '@/navigation/types';
import { businessApi } from '@/services/businessApi';
import { uploadBusinessImages } from '@/services/businessImageUpload';
import { pickAppealEvidenceFile, pickCameraPhoto } from '@/utils/documentPickers';
import {
  cleanupTokenCost,
  isAlteredCleanup,
  isInsufficientTokensError,
  needsToBuyTokens,
} from '@/utils/itemRejectionRecovery';
import type { BusinessCatalogItem } from '@/types/business/items';
import { IMAGE_LIBRARY_PICKER_OPTIONS } from '@/utils/supportedImageFormats';
import * as ImagePicker from 'expo-image-picker';
import { NeedsChangesCard } from './NeedsChangesCard';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

type Props = {
  item: BusinessCatalogItem;
  onChanged: () => Promise<unknown> | void;
  onEdit: () => void;
  onMessage: (text: string) => void;
};

export function ItemRecoverySection({ item, onChanged, onEdit, onMessage }: Props) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { me } = useProfileMe();
  const recoveryApi = useItemRejectionRecovery(item.id);
  const [busy, setBusy] = useState(false);
  const [selectedAiIds, setSelectedAiIds] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<Array<{ key: string; label: string }>>([]);
  const [compare, setCompare] = useState<{
    resultId: string;
    originalUrl: string;
    enhancedUrl: string;
    altered: boolean;
  } | null>(null);

  if (!recoveryApi.visible || !recoveryApi.recovery) return null;

  const photos = (item.item_images ?? [])
    .filter((image) => image.id && image.image_url)
    .map((image) => ({ id: image.id as string, image_url: image.image_url as string }));
  const cost = cleanupTokenCost(
    selectedAiIds.length || 1,
    recoveryApi.recovery.aiCleanup.costPerImage
  );

  return (
    <NeedsChangesCard
      recovery={recoveryApi.recovery}
      photos={photos}
      locked={recoveryApi.locked}
      hasLocalChanges={recoveryApi.hasLocalChanges}
      canResubmit={recoveryApi.canResubmit}
      warnAppealWithdraw={recoveryApi.warnAppealWithdraw}
      appealDisabledReason={recoveryApi.appealDisabledReason}
      busy={busy}
      selectedAiIds={selectedAiIds}
      onToggleAiId={(id) =>
        setSelectedAiIds((current) =>
          current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
        )
      }
      aiCostLabel={t('business.items.recovery.aiFix.cost', {
        n: cost,
        m: recoveryApi.recovery.aiCleanup.tokenBalance,
        defaultValue: `Cost: ${cost} tokens · You have ${recoveryApi.recovery.aiCleanup.tokenBalance}`,
      })}
      needsBuyTokens={needsToBuyTokens(cost, recoveryApi.recovery.aiCleanup.tokenBalance)}
      compare={compare}
      translationAvailable={Boolean(item.translation_available)}
      evidenceLabels={evidence.map((file) => file.label)}
      onAction={(id) => {
        if (id === 'edit_fields' || id === 'edit_price') onEdit();
      }}
      onResubmit={async (confirmWithdraw) => {
        setBusy(true);
        try {
          await recoveryApi.submitResubmit(confirmWithdraw);
          await onChanged();
        } finally {
          setBusy(false);
        }
      }}
      onSaveCondition={async (condition, wearNote) => {
        setBusy(true);
        try {
          await recoveryApi.saveCondition(condition, wearNote);
          await onChanged();
        } finally {
          setBusy(false);
        }
      }}
      onSubmitAppeal={async (reason) => {
        setBusy(true);
        try {
          await recoveryApi.submitAppeal(
            reason,
            evidence.map((file) => file.key)
          );
          setEvidence([]);
          await onChanged();
        } finally {
          setBusy(false);
        }
      }}
      onEvidenceExpired={() => void recoveryApi.reload()}
      onAddEvidence={async () => {
        const picked = await pickAppealEvidenceFile();
        if (!picked.ok) return;
        const key = await recoveryApi.uploadEvidence(picked.file);
        if (key) setEvidence((current) => [...current, { key, label: picked.file.fileName }]);
      }}
      onRetakeCamera={async (replaceId) => {
        await captureAndAttach(item, me?.business?.id, replaceId, 'camera', onChanged, recoveryApi.markChanged);
      }}
      onRetakeLibrary={async (replaceId) => {
        await captureAndAttach(item, me?.business?.id, replaceId, 'library', onChanged, recoveryApi.markChanged);
      }}
      onBuyTokens={() =>
        navigation.navigate('BusinessAiTokens', { returnItemId: item.id })
      }
      onRunAiFix={async (imageIds) => {
        setBusy(true);
        try {
          const next = await runCleanup(item.id, imageIds);
          setCompare(next);
        } catch (error: unknown) {
          if (isInsufficientTokensError(error)) {
            onMessage(t('business.items.recovery.aiFix.buy', 'Buy tokens'));
            return;
          }
          onMessage(error instanceof Error ? error.message : 'AI fix failed');
        } finally {
          setBusy(false);
        }
      }}
      onKeepAiFix={async () => {
        if (!compare) return;
        await businessApi.aiImageCleanup.accept(compare.resultId);
        recoveryApi.markChanged();
        setCompare(null);
        await onChanged();
      }}
      onDiscardAiFix={async () => {
        if (!compare) return;
        await businessApi.aiImageCleanup.reject(compare.resultId);
        setCompare(null);
      }}
      onTranslate={async (text) => {
        const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
        const result = await recoveryApi.translateText(text, lang);
        return result.available ? result.text : null;
      }}
    />
  );
}

async function captureAndAttach(
  item: BusinessCatalogItem,
  businessId: string | undefined,
  replaceId: string | null,
  source: 'camera' | 'library',
  onChanged: () => Promise<unknown> | void,
  markChanged: () => void
) {
  if (!businessId) return;
  const file =
    source === 'camera'
      ? await pickCameraPhoto()
      : await pickLibraryPhoto();
  if (!file.ok) return;
  const uploaded = await uploadBusinessImages(
    [
      {
        uri: file.file.uri,
        fileName: file.file.fileName,
        mimeType: file.file.contentType,
        width: 0,
        height: 0,
      } as ImagePicker.ImagePickerAsset,
    ],
    businessId
  );
  const imageId = uploaded[0];
  if (imageId) {
    await businessApi.images.associateItem(imageId, item.id);
  }
  if (replaceId) {
    await businessApi.images.deleteImage(replaceId);
  }
  markChanged();
  await onChanged();
}

async function pickLibraryPhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') {
    return { ok: false as const, reason: 'permission_denied' as const };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    ...IMAGE_LIBRARY_PICKER_OPTIONS,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) {
    return { ok: false as const, reason: 'canceled' as const };
  }
  const asset = result.assets[0];
  return {
    ok: true as const,
    file: {
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      contentType: asset.mimeType ?? 'image/jpeg',
    },
  };
}

async function runCleanup(itemId: string, imageIds: string[]) {
  const requested = await businessApi.aiImageCleanup.request(itemId, { imageIds });
  const jobId = requested.data?.job?.id;
  if (!jobId) return null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const job = await businessApi.aiImageCleanup.getJob(jobId);
    const result = job.data?.job?.results?.find((row: { cleaned_image_url?: string | null }) =>
      Boolean(row.cleaned_image_url)
    );
    if (result?.cleaned_image_url) {
      return {
        resultId: result.id,
        originalUrl: result.original_image_url,
        enhancedUrl: result.cleaned_image_url,
        altered: isAlteredCleanup(result),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}
