module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-environment.ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@garkuwa/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^@garkuwa/contracts/newsroom$': '<rootDir>/../../packages/contracts/src/newsroom.ts',
    '^@garkuwa/contracts/media$': '<rootDir>/../../packages/contracts/src/media.ts',
    '^@garkuwa/contracts/live$': '<rootDir>/../../packages/contracts/src/live.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
};
