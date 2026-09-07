import { Image, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

const SIZE = 80;
const OVERLAP = 18;

type Props = {
  urls: string[];
  overflowCount?: number;
};

/** Stacked thumbnails for multi-item order cards (up to 3 + overflow badge). */
export function OrderItemThumbStack({ urls, overflowCount = 0 }: Props) {
  const { colors, borderRadius } = useTheme();
  const show = urls.slice(0, 3);
  const width = show.length <= 1 ? SIZE : SIZE + OVERLAP * (show.length - 1);

  if (show.length === 0) {
    return (
      <View
        style={[
          styles.single,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: borderRadius.md,
            backgroundColor: colors.divider,
          },
        ]}
      >
        <MaterialCommunityIcons name="package-variant" size={36} color={colors.text.secondary} />
      </View>
    );
  }

  if (show.length === 1) {
    return (
      <View
        style={[
          styles.single,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: borderRadius.md,
            backgroundColor: colors.divider,
            overflow: 'hidden',
          },
        ]}
      >
        <Image source={{ uri: show[0] }} style={{ width: SIZE, height: SIZE }} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={{ width, height: SIZE }}>
      {show.map((uri, index) => (
        <View
          key={`${uri}-${index}`}
          style={[
            styles.stackItem,
            {
              left: index * OVERLAP,
              zIndex: show.length - index,
              borderRadius: borderRadius.md,
              borderColor: colors.surface,
              backgroundColor: colors.divider,
            },
          ]}
        >
          <Image source={{ uri }} style={{ width: SIZE - 8, height: SIZE - 8 }} resizeMode="cover" />
        </View>
      ))}
      {overflowCount > 0 ? (
        <View
          style={[
            styles.overflow,
            {
              backgroundColor: colors.primary.main,
              borderColor: colors.surface,
            },
          ]}
        >
          <Text style={{ color: colors.primary.contrast, fontSize: 10, fontWeight: '700' }}>
            +{overflowCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  single: { alignItems: 'center', justifyContent: 'center' },
  stackItem: {
    position: 'absolute',
    top: 0,
    width: SIZE - 8,
    height: SIZE - 8,
    overflow: 'hidden',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflow: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
});
