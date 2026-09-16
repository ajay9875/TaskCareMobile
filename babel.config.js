module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Only include this. Reanimated handles worklets internally 
      // in most Expo-compatible versions.
      'react-native-reanimated/plugin', 
    ],
  };
};