import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3010",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: [
    {
      command: "npm run dev -w apps/api",
      url: "http://127.0.0.1:4010/api/v1/health",
      env: {
        PORT: "4010",
        WEB_URL: "http://localhost:3010",
        DATABASE_MODE: "demo",
        DEMO_DATA_DIR: "../../test-results/data",
      },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -w apps/web -- --port 3010",
      url: "http://localhost:3010",
      env: { API_URL: "http://127.0.0.1:4010", NEXT_DIST_DIR: ".next-e2e" },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
