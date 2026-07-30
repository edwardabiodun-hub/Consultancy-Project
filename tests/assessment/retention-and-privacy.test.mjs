import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runAssessmentRetentionCleanup } from "../../lib/retention/assessment.ts";

const projectRoot = new URL("../../", import.meta.url);

test("retention cleanup atomically audits pre-delete counts before deleting 90-day-expired D1 data", async () => {
  const prepared = [];
  const auditRuns = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = { sql, values, run: async () => { auditRuns.push({ sql, values }); return { success: true }; } };
          prepared.push(statement);
          return statement;
        },
      };
    },
    async batch(statements) {
      assert.equal(statements.length, 5);
      return [
        { results: [{ count: 6 }] },
        { results: [{ count: 3 }] },
        { meta: { changes: 1 } },
        { meta: { changes: 6 } },
        { meta: { changes: 3 } },
      ];
    },
  };

  const result = await runAssessmentRetentionCleanup(db, {
    now: new Date("2026-07-29T12:00:00.000Z"),
    createId: () => "cleanup-1",
  });

  assert.equal(result.cutoff, "2026-04-30 12:00:00");
  assert.deepEqual(result, {
    cutoff: "2026-04-30 12:00:00",
    assessmentEventsDeleted: 6,
    assessmentRecordsDeleted: 3,
  });
  assert.match(prepared[0].sql, /SELECT COUNT\(\*\)/i);
  assert.match(prepared[1].sql, /SELECT COUNT\(\*\)/i);
  assert.match(prepared[2].sql, /INSERT INTO retention_cleanup_runs/i);
  assert.match(prepared[3].sql, /DELETE FROM assessment_events/i);
  assert.match(prepared[4].sql, /DELETE FROM assessment_records/i);
  assert.ok(prepared.every((statement) => statement.values.includes(result.cutoff)));
  assert.equal(auditRuns.length, 0, "audit insert must be part of the same D1 batch");
});

test("Cloudflare configuration schedules daily retention cleanup and rate-limits narrative and calculation requests", async () => {
  const config = JSON.parse(await readFile(new URL("wrangler.jsonc", projectRoot), "utf8"));
  assert.deepEqual(config.triggers.crons, ["17 3 * * *"]);
  assert.equal(config.ratelimits[0].name, "NARRATIVE_RATE_LIMITER");
  assert.equal(config.ratelimits[0].simple.limit, 3);
  assert.equal(config.ratelimits[0].simple.period, 60);
  const calculationLimiter = config.ratelimits.find((limiter) => limiter.name === "ASSESSMENT_CALCULATION_RATE_LIMITER");
  assert.ok(calculationLimiter);
  assert.equal(calculationLimiter.simple.period, 60);
  assert.ok(calculationLimiter.simple.limit > 0);
  const worker = await readFile(new URL("worker/index.ts", projectRoot), "utf8");
  assert.match(worker, /scheduled\s*\(/);
  assert.match(worker, /runAssessmentRetentionCleanup/);
});

test("privacy, consent, and operations docs disclose internal narrative email and 90-day retention", async () => {
  const [privacy, gate, readme] = await Promise.all([
    readFile(new URL("app/privacy/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/assessment/ContactGate.tsx", projectRoot), "utf8"),
    readFile(new URL("README.md", projectRoot), "utf8"),
  ]);
  for (const source of [privacy, readme]) {
    assert.match(source, /90 days/i);
    assert.match(source, /03:17 UTC/i);
    assert.match(source, /info@runrategroup\.com/i);
    assert.match(source, /name.*email.*company.*role/is);
    assert.match(source, /OpenAI.*(?:no|not).*identity.*raw answers/is);
    assert.match(source, /OpenAI.*scores.*confidence.*risk codes.*priorities.*capacity/is);
    assert.match(source, /narrative prose.*not.*D1/is);
    assert.match(source, /mailbox/is);
  }
  assert.match(gate, /internal assessment notification/i);
  assert.match(gate, /90 days/i);
  assert.match(readme, /0005_striped_wilson_fisk\.sql/i);
  assert.match(readme, /role.*null.*narrative/i);
});