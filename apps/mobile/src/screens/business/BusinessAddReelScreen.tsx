import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
  Chip,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReelComposerIllustration } from '@/components/reels/ReelComposerIllustration';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useProfileMe } from '@/hooks/useProfileMe';
import { useReelAiTokens } from '@/hooks/business/useReelAiTokens';
import { businessApi } from '@/services/businessApi';
import { getBusinessItems } from '@/services/rentalsApi';
import {
  createMerchantReel,
  createReelUploadUrl,
  fetchReelAiPresets,
  generateAiReel,
  putReelVideoToPresignedUrl,
  submitMerchantReel,
  type ReelAiPreset,
} from '@/services/merchantReelsApi';
import type { BusinessCatalogItem } from '@/types/business/items';
import type { BusinessRentalItemRow } from '@/types/rentals';

type PickerProduct = {
  subjectType: 'item' | 'rental';
  subjectId: string;
  name: string;
  imageUrl: string | null;
};

const MIN_UPLOAD_MS = 15_000;
const MAX_UPLOAD_MS = 30_000;

export default function BusinessAddReelScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useProfileMe();
  const { isSuperuser } = usePermissions();
  const { balance, refreshBalance } = useReelAiTokens();
  const [presets, setPresets] = useState<ReelAiPreset[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [selected, setSelected] = useState<PickerProduct | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  const marketCountry = (me?.country || 'CM').toUpperCase().slice(0, 2);
  const tokenBalance = balance ?? 0;
  const hasTokens = isSuperuser || tokenBalance > 0;
  const selectedHasPhoto = Boolean(selected?.imageUrl);
  const canGenerate =
    hasTokens &&
    Boolean(selected) &&
    selectedHasPhoto &&
    Boolean(presetId) &&
    (presetId !== 'custom' || Boolean(prompt.trim()));

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

  const onGenerate = useCallback(async () => {
    if (!selected) {
      setSnack(t('business.reels.add.pickProduct', 'Select a product first'));
      return;
    }
    if (!presetId) {
      setSnack(t('business.reels.add.pickStyle', 'Select an ad style first'));
      return;
    }
    if (!selectedHasPhoto) {
      setSnack(
        t(
          'business.reels.add.needPhoto',
          'Add at least one product photo before generating'
        )
      );
      return;
    }
    if (presetId === 'custom' && !prompt.trim()) {
      setSnack(t('business.reels.add.customPrompt', 'Enter a custom prompt'));
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
      });
      await refreshBalance();
      setSnack(
        t(
          'business.reels.add.generating',
          'Generating your 8s ad… this can take a minute.'
        )
      );
      navigation.goBack();
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
        t('business.reels.add.libraryPermission', 'Photo library permission is required')
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
      const upload = await createReelUploadUrl(reel.id, { fileName, contentType });
      await putReelVideoToPresignedUrl(upload.url, asset.uri, contentType);
      await submitMerchantReel(reel.id);
      setSnack(t('business.reels.add.uploaded', 'Reel uploaded and submitted'));
      navigation.goBack();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + 24,
          gap: spacing.md,
        }}
      >
        <View style={styles.hero}>
          <ReelComposerIllustration size={96} />
          <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
            {t('business.reels.add.title', 'Add reel')}
          </Text>
          <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
            {t(
              'business.reels.add.subtitle',
              'Generate an 8s AI product ad, or upload a 15–30s video from your library.'
            )}
          </Text>
          <Text style={{ color: colors.primary.main, fontWeight: '600' }}>
            {tokenLabel}
          </Text>
        </View>

        {loadingCatalog ? <ActivityIndicator /> : null}

        <Text variant="titleMedium" style={{ color: colors.text.primary }}>
          {t('business.reels.add.product', 'Product')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {products.map((product) => {
              const active = selected?.subjectId === product.subjectId;
              return (
                <Pressable
                  key={`${product.subjectType}-${product.subjectId}`}
                  onPress={() => setSelected(product)}
                  style={[
                    styles.productCard,
                    {
                      borderColor: active ? colors.primary.main : colors.divider,
                      backgroundColor: colors.background.paper,
                    },
                  ]}
                >
                  {product.imageUrl ? (
                    <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
                  ) : (
                    <View
                      style={[
                        styles.thumb,
                        { backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
                      ]}
                    >
                      <Text variant="labelSmall">
                        {t('business.reels.add.noPhoto', 'No photo')}
                      </Text>
                    </View>
                  )}
                  <Text numberOfLines={2} style={{ color: colors.text.primary, fontSize: 12 }}>
                    {product.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Text variant="titleMedium" style={{ color: colors.text.primary }}>
          {t('business.reels.add.style', 'Ad style')}
        </Text>
        <View style={styles.chips}>
          {presets.map((preset) => (
            <Chip
              key={preset.id}
              selected={presetId === preset.id}
              onPress={() => setPresetId(preset.id)}
              style={{ marginBottom: 8 }}
            >
              {t(preset.labelKey, preset.defaultLabel)}
            </Chip>
          ))}
        </View>

        <TextInput
          mode="outlined"
          label={t('business.reels.add.prompt', 'Optional direction')}
          value={prompt}
          onChangeText={setPrompt}
          maxLength={200}
        />
        <TextInput
          mode="outlined"
          label={t('business.reels.add.caption', 'Caption (optional)')}
          value={caption}
          onChangeText={setCaption}
          maxLength={2200}
        />

        <Button
          mode="contained"
          loading={busy}
          disabled={busy || !canGenerate}
          onPress={() => void onGenerate()}
        >
          {t('business.reels.add.generate', 'Generate AI ad (8s)')}
        </Button>

        {!hasTokens ? (
          <Button
            mode="outlined"
            onPress={() =>
              (navigation as { navigate: (n: string) => void }).navigate(
                'BusinessReelAiTokens'
              )
            }
          >
            {t('business.reels.add.buyTokens', 'Buy reel tokens')}
          </Button>
        ) : null}

        <Button
          mode="outlined"
          disabled={busy}
          onPress={() => void onUpload()}
        >
          {t('business.reels.add.upload', 'Upload from library (15–30s)')}
        </Button>
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </View>
  );
}

function mapSaleProducts(items: BusinessCatalogItem[]): PickerProduct[] {
  return items.map((item) => ({
    subjectType: 'item' as const,
    subjectId: item.id,
    name: item.name,
    imageUrl:
      item.item_images?.[0]?.display_url ||
      item.item_images?.[0]?.image_url ||
      null,
  }));
}

function mapRentalProducts(items: BusinessRentalItemRow[]): PickerProduct[] {
  return items.map((item) => ({
    subjectType: 'rental' as const,
    subjectId: item.id,
    name: item.name,
    imageUrl: item.rental_item_images?.[0]?.image_url || null,
  }));
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productCard: {
    width: 112,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  thumb: { width: '100%', height: 72, borderRadius: 8 },
});
