module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    // file-type v21 uses ESM exports not resolvable by Jest's CommonJS runner
    '^file-type$': '<rootDir>/__mocks__/file-type.js',
    // sharp uses platform-specific native binaries; mock to keep tests cross-platform
    '^sharp$': '<rootDir>/__mocks__/sharp.js',
  },
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    '!utils/logger.js',
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
};
