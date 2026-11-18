/** Unicode stand-in for the icon font. The capture does not load the real font files. */
import { Text } from 'react-native';

function Icon({ name, color, size }: { name?: string; color?: string; size?: number }) {
  const glyph = name === 'check' ? '✓' : name === 'close' ? '✕' : '•';
  return <Text style={{ color, fontSize: size ?? 18 }}>{glyph}</Text>;
}

export default Icon;
export const MaterialCommunityIcons = Icon;
export const MaterialIcons = Icon;
