import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
const launchOptions = {
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
};
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  use: { trace: 'retain-on-failure', launchOptions },
  projects: [
    {
      name: 'desktop',
      testMatch: 'public.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5174' },
    },
    {
      name: 'mobile',
      testMatch: 'public.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:5174',
      },
    },
    {
      name: 'workspace-desktop',
      testMatch:
        /workspace\.spec\.ts|workspace-states\.spec\.ts|admin-tools\.spec\.ts|payment-methods\.spec\.ts|cart-checkout\.spec\.ts|work-preview\.spec\.ts|guest-checkout\.spec\.ts|ai-assistant\.spec\.ts|promotions\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5175' },
    },
    {
      name: 'workspace-mobile',
      testMatch:
        /workspace\.spec\.ts|workspace-states\.spec\.ts|admin-tools\.spec\.ts|payment-methods\.spec\.ts|cart-checkout\.spec\.ts|work-preview\.spec\.ts|guest-checkout\.spec\.ts|ai-assistant\.spec\.ts|promotions\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:5175',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      env: {
        VITE_SUPABASE_DISABLED: 'true',
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175',
      env: {
        VITE_SUPABASE_DISABLED: 'false',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'browser-test-public-key',
        VITE_SUPABASE_ANON_KEY: '',
      },
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
