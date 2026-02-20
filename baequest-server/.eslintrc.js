module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "airbnb-base", "prettier"],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
    {
      // Jest globals for test files
      files: ["tests/**/*.js"],
      env: {
        jest: true,
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-underscore-dangle": ["error", { allow: ["_id"] }],
    // Allow req, res, next as conventional Express parameter names even when unused
    "no-unused-vars": ["error", { argsIgnorePattern: "^(req|res|next)$" }],
    // Allow console.error and console.warn for production error logging
    "no-console": ["warn", { allow: ["error", "warn"] }],
  },
};
