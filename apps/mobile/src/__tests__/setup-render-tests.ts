import 'react-native-gesture-handler/jestSetup';

// RN 0.83 + jest-expo: TurboModuleRegistry loads the real NativeModules
// (which throws without a bridge) unless this mock is registered first.
jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => {
  const actual = jest.requireActual('react-native/jest/mocks/NativeModules');
  const base = actual.default ?? actual;
  const platformConstants = {
    reactNativeVersion: { major: 0, minor: 83, patch: 6, prerelease: null },
    osVersion: '17.0',
    systemName: 'iOS',
    interfaceIdiom: 'phone',
    isTesting: true,
    forceTouchAvailable: false,
  };
  base.PlatformConstants = { getConstants: () => platformConstants };
  base.UIManager = {
    getConstants: () => ({ ViewManagerNames: [], BubblingEventTypes: {}, DirectEventTypes: {} }),
    getConstantsForViewManager: () => ({}),
    lazilyLoadView: () => null,
    createView: jest.fn(),
    updateView: jest.fn(),
    manageChildren: jest.fn(),
    dispatchViewManagerCommand: jest.fn(),
    measure: jest.fn(),
    getViewManagerConfig: jest.fn(() => ({})),
    hasViewManagerConfig: jest.fn(() => false),
  };
  return { __esModule: true, default: base };
});
jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => {
  const constants = {
    reactNativeVersion: { major: 0, minor: 83, patch: 6, prerelease: null },
    osVersion: '17.0',
    systemName: 'iOS',
    interfaceIdiom: 'phone',
    isTesting: true,
    forceTouchAvailable: false,
  };
  return { __esModule: true, default: { getConstants: () => constants } };
});

// Animated is provided by the jest-expo / React Native jest preset (AnimatedMock).

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  return {
    default: {
      createAnimatedComponent: (Component: any) => Component,
    },
    createAnimatedComponent: (Component: any) => Component,
    Easing: {
      linear: (t: number) => t,
      ease: (t: number) => t,
      quad: (t: number) => t,
      cubic: (t: number) => t,
    },
    useSharedValue: (value: any) => ({ value }),
    useAnimatedStyle: (fn: any) => fn(),
    withTiming: (value: any) => value,
    withSpring: (value: any) => value,
    withDelay: (_delay: number, value: any) => value,
    runOnJS: (fn: any) => fn,
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const SafeAreaInsetsContext = React.createContext(insets);
  const SafeAreaFrameContext = React.createContext(frame);
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        SafeAreaInsetsContext.Provider,
        { value: insets },
        React.createElement(SafeAreaFrameContext.Provider, { value: frame }, children),
      ),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics: { insets, frame },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
  NativeModulesProxy: {},
  EventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  requireOptionalNativeModule: jest.fn(),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      textDirection: 'ltr',
      digitGroupingSeparator: ',',
      decimalSeparator: '.',
      measurementSystem: 'metric',
      currencyCode: 'USD',
      currencySymbol: '$',
      regionCode: 'US',
    },
  ]),
  getCalendars: jest.fn(() => []),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'https://test.api.rendasua.com/api',
      auth0Domain: 'test.auth0.com',
    },
  },
  ExecutionEnvironment: {
    Standalone: 'STANDALONE',
    StoreClient: 'STORE_CLIENT',
    Bare: 'BARE',
  },
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: any) => React.createElement(Text, props, props.name);
  return {
    MaterialCommunityIcons: MockIcon,
    MaterialIcons: MockIcon,
    Ionicons: MockIcon,
    FontAwesome: MockIcon,
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
