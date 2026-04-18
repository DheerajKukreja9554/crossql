import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Expects both backend and frontend to be running
  webServer: [
    {
      command: "cd ../backend && uv run uvicorn main:app --port 8000",
      port: 8000,
      reuseExistingServer: true,
    },
    {
      command: "cd ../frontend && npm run dev",
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
