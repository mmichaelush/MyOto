import { defineConfig } from '@playwright/test';

const preview = process.env.MYOTO_PREVIEW_BASE;
const server = 'http://127.0.0.1:4321';
const mode = process.env.MYOTO_E2E_STATIC ? 'preview' : 'dev';

export default defineConfig({
  testDir: 'tests/browser',
  snapshotPathTemplate: '{testDir}/goldens/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.025 },
  },
  use: { baseURL: preview ?? server },
  webServer: preview
    ? undefined
    : {
        command: `npm run ${mode} -- --host 127.0.0.1 --port 4321`,
        url: server + '/MyOto/',
      },
});
