// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "android/*", "ios/*", ".expo/*", "node_modules/*", "coverage/*"] },
  {
    rules: {
      // HTML-entity escaping doesn't apply to React Native <Text>.
      "react/no-unescaped-entities": "off",
      // React Compiler readiness checks. The compiler isn't enabled in this app; these stay visible as
      // warnings so they can be cleaned up deliberately (docs/PARITY.md) instead of in a mass rewrite.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);
