module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
    ecmaVersion: 2020,
  },
  ignorePatterns: [
    "/lib/**/*",
    "/generated/**/*",
    "/node_modules/**/*",
    "/src/@types/**/*", // Add this to ignore custom type files
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "max-len": ["error", {
      "code": 120, // Increased to 120 characters
      "ignoreUrls": true,
      "ignoreStrings": true,
      "ignoreTemplateLiterals": true,
      "ignoreRegExpLiterals": true,
      "ignoreComments": true,
    }],
    "object-curly-spacing": ["error", "always"],
    "comma-dangle": ["error", "only-multiline"],
    "require-jsdoc": "off",
    "linebreak-style": "off", // Disable linebreak check
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
  overrides: [
    {
      files: ["**/*.d.ts"],
      rules: {
        "max-len": "off", // Disable for type declaration files
        "quotes": "off",
      },
    },
  ],
};
