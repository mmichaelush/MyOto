import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  snapshotPathTemplate: '{testDir}/goldens/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.025 },
  },
  use: { baseURL: 'http://127.0.0.1:4321' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321/MyOto/',
  },
});
