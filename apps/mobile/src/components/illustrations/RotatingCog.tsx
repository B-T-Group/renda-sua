import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

/** Continuously rotating cog for maintenance / update-in-progress. */
export function RotatingCog({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Updating"
      style={{ transform: [{ rotate }] }}
    >
      <MaterialCommunityIcons name="cog" size={size} color={colors.primary.main} />
    </Animated.View>
  );
}
