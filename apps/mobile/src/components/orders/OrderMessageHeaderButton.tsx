import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  onPress: () => void;
};

/**
 * High-visibility order-detail header CTA for messaging.
 * Soft pulse draws the eye; filled primary + label stay clear when motion is reduced.
 * Only the ring animates — scaling the pill itself gets clipped by React Navigation's header.
 */
export function OrderMessageHeaderButton({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  const label = t('orders.actions.message', 'Message');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.pressable}
    >
      <View style={styles.wrap}>
        {!reducedMotion ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              styles.ring,
              {
                borderColor: colors.primary.main,
                borderRadius: borderRadius.full,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.pill,
            {
              backgroundColor: colors.primary.main,
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing.sm,
              gap: spacing.xxs,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="message-text"
            size={18}
            color={colors.primary.contrast}
          />
          <Text
            style={[
              typography.caption,
              styles.label,
              { color: colors.primary.contrast },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginRight: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  wrap: {
    // Padding reserves layout space for the pulse ring so headerRight does not clip.
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingVertical: 8,
  },
  label: {
    fontWeight: '700',
    lineHeight: 16,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null),
  },
});
