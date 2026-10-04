import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hapticAllowed, type HapticKind } from './hapticsPolicy';

let reduceMotion = false;

export function setHapticsReduceMotion(value: boolean): void {
  reduceMotion = value;
}

async function play(kind: HapticKind): Promise<void> {
  if (!hapticAllowed(Platform.OS, reduceMotion)) return;
  if (kind === 'selection') {
    await Haptics.selectionAsync();
    return;
  }
  if (kind === 'impactLight') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }
  const type =
    kind === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning;
  await Haptics.notificationAsync(type);
}

export const haptics = {
  selection: () => play('selection'),
  success: () => play('success'),
  warning: () => play('warning'),
  impactLight: () => play('impactLight'),
};
