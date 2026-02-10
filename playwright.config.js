import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/system',
  timeout: 40000,
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['list'], ['html']] : 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on',
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60000,
  },
});
