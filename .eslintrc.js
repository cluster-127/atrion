module.exports = {
  plugins: ['functional'],
  rules: {
    'functional/no-let': 'error',
    'functional/immutable-data': 'error',
    'functional/prefer-readonly-type': 'error',
    'no-restricted-globals': [
      'error',
      { name: 'Date', message: 'Use VirtualClock instead.' },
      { name: 'Math.random', message: 'Use seeded random or external input.' },
    ],
  },
}
