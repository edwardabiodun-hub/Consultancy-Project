import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readJsonc(relativePath) {
  const source = await readFile(new URL(relativePath, projectRoot), "utf8");
  return JSON.parse(source.replace(/^\s*\/\/.*$/gm, ""));
}

test("Cloudflare deployment config exposes the Worker, assets, Images, and D1 bindings", async () => {
  const config = await readJsonc("wrangler.jsonc");

  assert.equal(config.name, "runrate-advisory");
  assert.equal(config.main, "./worker/index.ts");
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.equal(config.compatibility_date, "2026-05-22");
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.assets.run_worker_first, false);
  assert.equal(config.images.binding, "IMAGES");
  assert.equal(config.vars.NEXT_PUBLIC_SITE_URL, "https://www.runrategroup.com");

  assert.equal(config.d1_databases.length, 1);
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.equal(config.d1_databases[0].database_name, "runrate-advisory-production");
  assert.match(config.d1_databases[0].database_id, /^[0-9a-f-]{36}$/);
  assert.equal(config.d1_databases[0].migrations_dir, "drizzle");
  const calculationLimiter = config.ratelimits.find((limiter) => limiter.name === "ASSESSMENT_CALCULATION_RATE_LIMITER");
  assert.ok(calculationLimiter, "calculation requests need a dedicated Cloudflare rate-limit binding");
  assert.equal(calculationLimiter.simple.period, 60);
  assert.ok(calculationLimiter.simple.limit > 0);
});

test("the Vite Cloudflare plugin reads the committed Wrangler config", async () => {
  const viteConfig = await readFile(new URL("vite.config.ts", projectRoot), "utf8");

  assert.match(viteConfig, /configPath:\s*["']\.\/wrangler\.jsonc["']/);
  assert.doesNotMatch(viteConfig, /SITE_CREATOR_PLACEHOLDER_DATABASE_ID/);
});

test("the package scripts include explicit Cloudflare build, migration, and deploy commands", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", projectRoot), "utf8"),
  );

  assert.equal(packageJson.scripts["test:deployment"], "node --test tests/cloudflare-deployment.test.mjs");
  assert.match(packageJson.scripts["test:component"], /--test-concurrency=1/);
  assert.equal(packageJson.scripts["cf:build"], "npm run build");
  assert.equal(
    packageJson.scripts["cf:migrate"],
    "wrangler d1 migrations apply runrate-advisory-production --remote",
  );
  assert.equal(
    packageJson.scripts["cf:deploy"],
    "wrangler deploy --config dist/server/wrangler.json",
  );
});
test("public metadata falls back to the production RunRate domain", async () => {
  const sitemap = await readFile(new URL("app/sitemap.ts", projectRoot), "utf8");
  const robots = await readFile(new URL("app/robots.ts", projectRoot), "utf8");

  assert.match(sitemap, /https:\/\/www\.runrategroup\.com/);
  assert.match(robots, /https:\/\/www\.runrategroup\.com/);
  assert.doesNotMatch(sitemap, /https:\/\/example\.com/);
  assert.doesNotMatch(robots, /https:\/\/example\.com/);
});
