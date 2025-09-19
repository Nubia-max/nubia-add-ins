module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    globals: {
        Office: 'readonly',
        Excel: 'readonly',
        Word: 'readonly',
        PowerPoint: 'readonly'
    },
    rules: {
        'no-unused-vars': 'warn',
        'no-console': 'off',
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'indent': ['error', 4],
        'no-trailing-spaces': 'error',
        'eol-last': 'error'
    }
};