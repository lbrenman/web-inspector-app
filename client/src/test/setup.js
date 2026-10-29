import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Auto-cleanup only registers when test globals are enabled, which we keep off.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
