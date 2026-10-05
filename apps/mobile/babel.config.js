module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last. Preset auto-detect misses this package in the monorepo OTA publish.
    plugins: ['react-native-worklets/plugin'],
  };
};
