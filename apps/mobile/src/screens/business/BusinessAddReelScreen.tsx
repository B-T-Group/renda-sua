import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { BusinessListingWizardShell } from '@/components/business/BusinessListingWizardShell';
import { AddReelAiSettingsStep } from '@/components/reels/add-reel/AddReelAiSettingsStep';
import { AddReelModeStep } from '@/components/reels/add-reel/AddReelModeStep';
import { AddReelProductStep } from '@/components/reels/add-reel/AddReelProductStep';
import { AddReelTipsStep } from '@/components/reels/add-reel/AddReelTipsStep';
import { AddReelUploadStep } from '@/components/reels/add-reel/AddReelUploadStep';
import {
  mapRentalProducts,
  mapSaleProducts,
} from '@/components/reels/add-reel/addReelProductMappers';
import {
  ADD_REEL_STEP_COUNT,
  ADD_REEL_STEP_ORDER,
  type AddReelMode,
  type AddReelWizardStep,
  type PickerProduct,
} from '@/components/reels/add-reel/addReelTypes';
import { usePermissions } from '@/hooks/usePermissions';
import { useProfileMe } from '@/hooks/useProfileMe';
import { useReelAiTokens } from '@/hooks/business/useReelAiTokens';
import type { BusinessRootStackParamList } from '@/navigation/types';
import { businessApi } from '@/services/businessApi';
import {
  createMerchantReel,
  createReelUploadUrl,
  fetchReelAiPresets,
  generateAiReel,
  putReelVideoToPresignedUrl,
  submitMerchantReel,
  type ReelAiPreset,
} from '@/services/merchantReelsApi';
import { getBusinessItems } from '@/services/rentalsApi';
import { reelAiTokenCost, type ReelAiVeoTier } from '@/utils/reelAiTokenCost';

type Route = NativeStackScreenProps<
  BusinessRootStackParamList,
  'BusinessAddReel'
>['route'];

const MIN_UPLOAD_MS = 15_000;
const MAX_UPLOAD_MS = 30_000;

export default function BusinessAddReelScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const route = useRoute<Route>();
  const preselectType = route.params?.subjectType;
  const preselectId = route.params?.subjectId;
  const { me } = useProfileMe();
  const { isSuperuser } = usePermissions();
  const { balance, refreshBalance } = useReelAiTokens();

  const [step, setStep] = useState<AddReelWizardStep>('mode');
  const [mode, setMode] = useState<AddReelMode | null>(null);
  const [presets, setPresets] = useState<ReelAiPreset[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [selected, setSelected] = useState<PickerProduct | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [caption, setCaption] = useState('');
  const [tier, setTier] = useState<ReelAiVeoTier>('fast');
  const [busy, setBusy] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  const marketCountry = (me?.country || 'CM').toUpperCase().slice(0, 2);
  const tokenBalance = balance ?? 0;
  const tokenCost = useMemo(() => reelAiTokenCost(tier), [tier]);
  const canAfford = isSuperuser || tokenBalance >= tokenCost;
  const selectedHasPhoto = Boolean(selected?.imageUrl);
  const canGenerate =
    canAfford &&
    Boolean(selected) &&
    selectedHasPhoto &&
    Boolean(presetId);

  const stepIndex = ADD_REEL_STEP_ORDER.indexOf(step);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCatalog(true);
        const [presetRows, saleRes, rentalRows] = await Promise.all([
          fetchReelAiPresets(),
          businessApi.catalog.getItems(),
          getBusinessItems(),
        ]);
        if (cancelled) return;
        setPresets(presetRows);
        if (presetRows.length && !cancelled) {
          setPresetId((current) => current ?? presetRows[0]?.id ?? 'dynamic');
        }
        setProducts([
          ...mapSaleProducts(saleRes.data?.items ?? []),
          ...mapRentalProducts(rentalRows),
        ]);
      } catch (err: unknown) {
        if (!cancelled) {
          setSnack(
            err instanceof Error
              ? err.message
              : t('business.reels.add.loadError', 'Could not load products')
          );
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!preselectId || !preselectType || selected) return;
    const match = products.find(
      (p) => p.subjectId === preselectId && p.subjectType === preselectType
    );
    if (match) setSelected(match);
  }, [preselectId, preselectType, products, selected]);

  const applyPreselect = useCallback(() => {
    if (!preselectId || !preselectType) return null;
    return (
      products.find(
        (p) => p.subjectId === preselectId && p.subjectType === preselectType
      ) ?? null
    );
  }, [preselectId, preselectType, products]);

  const onRestart = useCallback(() => {
    setStep('mode');
    setMode(null);
    setPresetId(null);
    setPrompt('');
    setCaption('');
    setTier('fast');
    setSelected(applyPreselect());
  }, [applyPreselect]);

  const onWizardBack = useCallback(() => {
    if (step === 'mode') {
      navigation.goBack();
      return;
    }
    const idx = ADD_REEL_STEP_ORDER.indexOf(step);
    setStep(ADD_REEL_STEP_ORDER[Math.max(0, idx - 1)]);
  }, [navigation, step]);

  const goNext = useCallback(() => {
    const idx = ADD_REEL_STEP_ORDER.indexOf(step);
    if (idx < ADD_REEL_STEP_ORDER.length - 1) {
      setStep(ADD_REEL_STEP_ORDER[idx + 1]);
    }
  }, [step]);

  const onGenerate = useCallback(async () => {
    if (!selected || !presetId) return;
    if (!selectedHasPhoto) {
      setSnack(
        t(
          'business.reels.add.needPhoto',
          'Add at least one product photo before generating'
        )
      );
      return;
    }
    setBusy(true);
    try {
      await generateAiReel({
        subjectType: selected.subjectType,
        subjectId: selected.subjectId,
        presetId,
        prompt: prompt.trim() || undefined,
        caption: caption.trim() || undefined,
        marketCountry,
        tier,
      });
      await refreshBalance();
      navigation.replace('BusinessReelAiSubmitted');
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('business.reels.add.generateError', 'Generation failed')
      );
    } finally {
      setBusy(false);
    }
  }, [
    selected,
    selectedHasPhoto,
    presetId,
    prompt,
    caption,
    marketCountry,
    tier,
    refreshBalance,
    navigation,
    t,
  ]);

  const onUpload = useCallback(async () => {
    if (!selected) {
      setSnack(t('business.reels.add.pickProduct', 'Select a product first'));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSnack(
        t(
          'business.reels.add.libraryPermission',
          'Photo library permission is required'
        )
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 30,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const normalizedMs =
      asset.duration && asset.duration < 1000
        ? Math.round(asset.duration * 1000)
        : Math.round(asset.duration ?? 0);
    if (normalizedMs < MIN_UPLOAD_MS || normalizedMs > MAX_UPLOAD_MS) {
      setSnack(
        t(
          'business.reels.add.durationError',
          'Upload a video between 15 and 30 seconds'
        )
      );
      return;
    }
    setBusy(true);
    try {
      const reel = await createMerchantReel({
        subjectType: selected.subjectType,
        subjectId: selected.subjectId,
        marketCountry,
        caption: caption.trim() || undefined,
      });
      const contentType = asset.mimeType || 'video/mp4';
      const fileName = asset.fileName || `reel-${Date.now()}.mp4`;
      const upload = await createReelUploadUrl(reel.id, {
        fileName,
        contentType,
      });
      await putReelVideoToPresignedUrl(upload.url, asset.uri, contentType);
      await submitMerchantReel(reel.id);
      navigation.replace('BusinessReelUploadSubmitted');
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('business.reels.add.uploadError', 'Upload failed')
      );
    } finally {
      setBusy(false);
    }
  }, [selected, caption, marketCountry, navigation, t]);

  const tokenLabel = useMemo(() => {
    if (isSuperuser) {
      return t('business.reels.add.unlimitedTokens', 'Unlimited AI tokens');
    }
    return t('business.reels.add.tokenBalance', '{{count}} AI reel tokens', {
      count: tokenBalance,
    });
  }, [isSuperuser, tokenBalance, t]);

  const stepLabel = useMemo(() => {
    switch (step) {
      case 'mode':
        return t('business.reels.add.stepMode', 'Method');
      case 'tips':
        return t('business.reels.add.stepTips', 'Tips');
      case 'product':
        return t('business.reels.add.stepProduct', 'Product');
      case 'compose':
        return mode === 'upload'
          ? t('business.reels.add.stepUpload', 'Upload')
          : t('business.reels.add.stepSettings', 'Generate');
      default:
        return '';
    }
  }, [mode, step, t]);

  return (
    <BusinessListingWizardShell
      title={t('business.reels.add.title', 'Add reel')}
      stepIndex={Math.max(0, stepIndex)}
      stepCount={ADD_REEL_STEP_COUNT}
      stepLabel={stepLabel}
      progressLabel={t(
        'business.reels.add.stepProgress',
        'Step {{current}} of {{total}}',
        {
          current: stepIndex + 1,
          total: ADD_REEL_STEP_COUNT,
        }
      )}
      onBack={busy ? () => undefined : onWizardBack}
      onRestart={busy || step === 'mode' ? undefined : onRestart}
    >
      {step === 'mode' ? (
        <AddReelModeStep
          mode={mode}
          tokenLabel={tokenLabel}
          showBuyTokens={!isSuperuser && tokenBalance < 2}
          onSelectMode={setMode}
          onBuyTokens={() => navigation.navigate('BusinessReelAiTokens')}
          onContinue={() => {
            if (!mode) return;
            goNext();
          }}
        />
      ) : null}

      {step === 'tips' && mode ? (
        <AddReelTipsStep mode={mode} onContinue={goNext} />
      ) : null}

      {step === 'product' && mode ? (
        <AddReelProductStep
          mode={mode}
          products={products}
          selected={selected}
          loading={loadingCatalog}
          onSelect={setSelected}
          onContinue={goNext}
          onAddProduct={() => navigation.navigate('BusinessAddItemFromImage')}
        />
      ) : null}

      {step === 'compose' && mode === 'ai' ? (
        <AddReelAiSettingsStep
          presets={presets}
          presetId={presetId}
          prompt={prompt}
          caption={caption}
          tier={tier}
          tokenCost={tokenCost}
          canAfford={canAfford}
          canGenerate={canGenerate}
          busy={busy}
          onPresetId={setPresetId}
          onPrompt={setPrompt}
          onCaption={setCaption}
          onTier={setTier}
          onGenerate={() => void onGenerate()}
          onBuyTokens={() => navigation.navigate('BusinessReelAiTokens')}
        />
      ) : null}

      {step === 'compose' && mode === 'upload' ? (
        <AddReelUploadStep
          product={selected}
          caption={caption}
          busy={busy}
          onCaption={setCaption}
          onUpload={() => void onUpload()}
        />
      ) : null}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </BusinessListingWizardShell>
  );
}
