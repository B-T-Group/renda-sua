import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export interface ListingPreviewModel {
  title: string;
  imageUri?: string | null;
  priceLine?: string | null;
  metaLines?: string[];
  description?: string | null;
  locationLine?: string | null;
}

export interface ListingPreviewSheetProps {
  visible: boolean;
  onDismiss: () => void;
  model: ListingPreviewModel;
}

export function ListingPreviewSheet({
  visible,
  onDismiss,
  model,
}: ListingPreviewSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Text variant="titleLarge" style={{ color: colors.text.primary }}>
              {t('business.listingPreview.title', 'Listing preview')}
            </Text>
            <Text
              variant="labelMedium"
              style={{
                color: colors.text.secondary,
                marginTop: spacing.xs,
                marginBottom: spacing.md,
              }}
            >
              {t(
                'business.listingPreview.buyerHint',
                'Approximate view of what customers will see'
              )}
            </Text>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.card,
                {
                  borderColor: colors.divider,
                  backgroundColor: colors.pageBackground,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              {model.imageUri ? (
                <Image
                  source={{ uri: model.imageUri }}
                  style={styles.hero}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={[
                    styles.heroPlaceholder,
                    { backgroundColor: colors.divider },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.text.secondary }}
                  >
                    {t('business.listingPreview.noPhoto', 'No photo')}
                  </Text>
                </View>
              )}
              <View style={{ padding: spacing.md, gap: 6 }}>
                <Text
                  variant="titleMedium"
                  style={{ color: colors.text.primary }}
                >
                  {model.title}
                </Text>
                {model.priceLine ? (
                  <Text
                    variant="titleSmall"
                    style={{ color: colors.primary.main }}
                  >
                    {model.priceLine}
                  </Text>
                ) : null}
                {model.locationLine ? (
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.text.secondary }}
                  >
                    {model.locationLine}
                  </Text>
                ) : null}
                {(model.metaLines ?? []).map((line) => (
                  <Text
                    key={line}
                    variant="bodySmall"
                    style={{ color: colors.text.secondary }}
                  >
                    {line}
                  </Text>
                ))}
                {model.description ? (
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.text.primary, marginTop: 4 }}
                    numberOfLines={6}
                  >
                    {model.description}
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.actions,
              {
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
              },
            ]}
          >
            <Button mode="text" onPress={onDismiss}>
              {t('common.close', 'Close')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: 180,
  },
  heroPlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
