module.exports = {
  env: {
    node:true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'eslint:recommended'
  ],
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    indent: ['error', 2],
    quotes: [1, 'single'],
    semi: ['error', 'never']
  }
}
