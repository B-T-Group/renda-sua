import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface ModerationImage {
  id?: string;
  image_url: string;
  display_order?: number;
}

interface Props {
  images: ModerationImage[];
}

const THUMB_SIZE = 80;
const THUMB_SMALL = 56;

export function ModerationImagePreview({ images }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isOpen = previewIndex !== null;
  const current = previewIndex ?? 0;

  const goNext = () =>
    setPreviewIndex((i) => Math.min((i ?? 0) + 1, images.length - 1));
  const goPrev = () => setPreviewIndex((i) => Math.max((i ?? 0) - 1, 0));

  if (images.length === 0) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            backgroundColor: colors.pageBackground,
            borderColor: colors.divider,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="image-off-outline"
          size={24}
          color={colors.text.disabled}
        />
        <Text
          style={[styles.placeholderText, { color: colors.text.disabled }]}
          variant="bodySmall"
        >
          {t('admin.moderation.noImages', 'No images')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.strip, { gap: spacing.xs }]}
      >
        {images.map((img, idx) => (
          <Pressable key={img.id ?? idx} onPress={() => setPreviewIndex(idx)}>
            <Image
              source={{ uri: img.image_url }}
              style={[
                idx === 0 ? styles.thumbMain : styles.thumbSmall,
                {
                  borderRadius: borderRadius.sm,
                  borderWidth: 1,
                  borderColor: colors.divider,
                },
              ]}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.scrim}
          onPress={() => setPreviewIndex(null)}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                width: screenWidth,
                height: screenHeight,
                paddingTop: insets.top + spacing.sm,
                paddingBottom: insets.bottom + spacing.sm,
                backgroundColor: 'rgba(0,0,0,0.93)',
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close + counter row */}
            <View style={styles.header}>
              <Text
                style={[styles.counter, { color: '#ffffff' }]}
                variant="bodyMedium"
              >
                {images.length > 1
                  ? t('admin.moderation.imageOf', '{{current}} of {{total}}', {
                      current: current + 1,
                      total: images.length,
                    })
                  : t('admin.moderation.imagePreview', 'Image preview')}
              </Text>
              <IconButton
                icon="close"
                iconColor="#ffffff"
                size={24}
                onPress={() => setPreviewIndex(null)}
              />
            </View>

            {/* Full image */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: images[current]?.image_url }}
                style={{ width: screenWidth, height: screenHeight * 0.75 }}
                resizeMode="contain"
              />
            </View>

            {/* Prev / Next navigation */}
            {images.length > 1 && (
              <View style={styles.navRow}>
                <IconButton
                  icon="chevron-left"
                  iconColor="#ffffff"
                  size={32}
                  disabled={current === 0}
                  onPress={goPrev}
                />
                <View style={[styles.dotRow, { gap: spacing.xs }]}>
                  {images.map((_, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => setPreviewIndex(idx)}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            idx === current
                              ? '#ffffff'
                              : 'rgba(255,255,255,0.35)',
                        },
                      ]}
                    />
                  ))}
                </View>
                <IconButton
                  icon="chevron-right"
                  iconColor="#ffffff"
                  size={32}
                  disabled={current === images.length - 1}
                  onPress={goNext}
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  thumbMain: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbSmall: {
    width: THUMB_SMALL,
    height: THUMB_SMALL,
  },
  placeholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  placeholderText: {
    marginLeft: 4,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  counter: {
    marginLeft: 8,
    opacity: 0.9,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
