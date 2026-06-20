/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: ['plugin:vue/vue3-essential', '@vue/eslint-config-typescript'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  ignorePatterns: ['dist', 'node_modules', 'env.d.ts', '*.config.*', '.eslintrc.cjs'],
  rules: {
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
  },
};
