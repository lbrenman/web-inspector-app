module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],
  // Test files share one database and truncate between tests, so they must not run in parallel.
  maxWorkers: 1,
  restoreMocks: true,
};
