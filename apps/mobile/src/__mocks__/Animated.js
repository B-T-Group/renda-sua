// Mock for react-native Animated
const mockAnimatedValue = { setValue: jest.fn(), interpolate: jest.fn() };
const mockAnimated = {
  Value: jest.fn(() => mockAnimatedValue),
  timing: jest.fn(() => ({ start: jest.fn() })),
  spring: jest.fn(() => ({ start: jest.fn() })),
  add: jest.fn(),
  subtract: jest.fn(),
  multiply: jest.fn(),
  divide: jest.fn(),
  modulo: jest.fn(),
  diffClamp: jest.fn(),
  delay: jest.fn(),
  sequence: jest.fn(),
  parallel: jest.fn(),
  stagger: jest.fn(),
  event: jest.fn(),
  createAnimatedComponent: (Component) => Component,
  View: require('react-native').View,
  Text: require('react-native').Text,
  Image: require('react-native').Image,
  ScrollView: require('react-native').ScrollView,
};

module.exports = mockAnimated;
