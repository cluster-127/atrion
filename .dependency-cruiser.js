module.exports = {
  forbidden: [
    {
      name: 'no-impure-core',
      comment: 'AARS 1.1: src/core MUST be pure. No IO, No Network, No Random.',
      severity: 'error',
      from: { path: '^src/core' },
      to: {
        path: ['^src/infrastructure', '^node_modules'],
        dependencyTypes: ['npm', 'core'],
        pathNot: ['^node_modules/decimal.js'],
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: { doNotFollow: { path: 'node_modules' } },
}
