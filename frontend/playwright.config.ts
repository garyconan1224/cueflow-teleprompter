import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true
  },
  webServer: {
    command: "npm.cmd run preview:host",
    port: 4173,
    reuseExistingServer: true,
    timeout: 60_000
  }
});
