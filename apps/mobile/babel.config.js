module.exports = function (api) {
  api.cache(true);

  // Explicitly require the expo-router babel plugin since babel-preset-expo
  // can't find expo-router from the root node_modules in this monorepo setup.
  const expoRouterPlugin = require(
    require.resolve("babel-preset-expo/build/expo-router-plugin", {
      paths: [__dirname],
    })
  ).expoRouterBabelPlugin;

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [expoRouterPlugin, "react-native-reanimated/plugin"],
  };
};
