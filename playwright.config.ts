import { defineConfig, devices } from "@playwright/test";

const PORT = 3177;

// Real-browser accessibility QA for the Business Independence Assessment
// (Task 12, Step 2). This is deliberately narrow in scope: static structure,
// pointer-vs-keyboard reachability, and the domain logic in
// tests/assessment/*.test.mjs and tests/component/*.test.mjs already cover
// everything jsdom can simulate. Playwright is used only for what jsdom
// cannot verify: real layout (viewport overflow), real computed CSS
// (contrast ratios, reduced-motion transitions), and true keyboard-driven
// interaction against a fully rendered, styled DOM.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    // `vinext start`'s own static-file server does not correctly serve the
    // client asset chunks in this environment (verified: files exist on
    // disk in dist/client/assets but 404 under `vinext start`). `wrangler
    // dev` against the build's generated wrangler.json honors the Workers
    // `assets` binding correctly and also provides a real local D1
    // database, so it is used here instead.
    command: `npx wrangler dev --config dist/server/wrangler.json --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
