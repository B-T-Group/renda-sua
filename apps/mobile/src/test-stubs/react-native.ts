/** Vitest stub — react-native cannot be parsed by Rollup in Node test env. */
import React from 'react';

export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: { ios?: T; android?: T; web?: T; default?: T }): T =>
    (obj.ios ?? obj.default) as T,
};

export const Alert = {
  alert: () => {},
};

export const Vibration = {
  vibrate: () => {},
};

export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
};

export const InteractionManager = {
  runAfterInteractions: (callback?: () => void) => {
    callback?.();
    return { then: (cb?: () => void) => cb?.(), done: () => {}, cancel: () => {} };
  },
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

export const StyleSheet = {
  create: <T extends Record<string, object>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  hairlineWidth: 1,
};

// Basic React Native components for testing
export const View = ({ children, ...props }: any) => React.createElement('View', props, children);
export const Text = ({ children, ...props }: any) => React.createElement('Text', props, children);
export const ScrollView = ({ children, ...props }: any) => React.createElement('ScrollView', props, children);
export const Pressable = ({ children, ...props }: any) => React.createElement('Pressable', props, children);
export const TouchableOpacity = ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children);
export const TextInput = ({ ...props }: any) => React.createElement('TextInput', props);
export const Image = ({ ...props }: any) => React.createElement('Image', props);
export const ActivityIndicator = ({ ...props }: any) => React.createElement('ActivityIndicator', props);

export default {
  Platform,
  Alert,
  Vibration,
  AppState,
  InteractionManager,
  Dimensions,
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
};
