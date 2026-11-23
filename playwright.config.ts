import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  snapshotPathTemplate: '{testDir}/goldens/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.025 },
  },
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run dev -- --port 4321',
    url: 'http://localhost:4321/MyOto/',
  },
});
