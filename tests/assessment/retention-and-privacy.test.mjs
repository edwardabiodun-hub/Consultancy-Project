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
          const statement = {
            sql,
            values,
            run: async () => {
              auditRuns.push({ sql, values });
              return { success: true };
            },
          };
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
  assert.ok(
    prepared.every((statement) => statement.values.includes(result.cutoff)),
  );
  assert.equal(
    auditRuns.length,
    0,
    "audit insert must be part of the same D1 batch",
  );
});

test("retention cleanup deletes report objects before D1 rows", async () => {
  const calls = [];
  const reports = {
    async delete(key) {
      calls.push(`r2:${key}`);
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return { run: async () => undefined };
        },
      };
    },
    async batch(statements) {
      if (statements.length === 1)
        return [
          {
            results: [
              {
                id: "expired-1",
                report_snapshot_key: "snapshot.json",
                report_pdf_key: "report.pdf",
              },
            ],
          },
        ];
      calls.push("d1");
      return [
        { results: [{ count: 0 }] },
        { results: [{ count: 1 }] },
        {},
        {},
        {},
      ];
    },
  };
  const result = await runAssessmentRetentionCleanup(db, reports, {
    createId: () => "cleanup-r2",
  });
  assert.deepEqual(calls, ["r2:snapshot.json", "r2:report.pdf", "d1"]);
  assert.equal(result.reportObjectsDeleted, 2);
});
test("retention cleanup treats a missing R2 object as already deleted", async () => {
  const deleted = [];
  const reports = {
    async delete(key) {
      deleted.push(key);
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return { run: async () => undefined };
        },
      };
    },
    async batch(statements) {
      if (statements.length === 1)
        return [
          {
            results: [
              {
                id: "expired-1",
                report_snapshot_key: "missing.json",
                report_pdf_key: null,
              },
            ],
          },
        ];
      return [
        { results: [{ count: 0 }] },
        { results: [{ count: 1 }] },
        {},
        {},
        {},
      ];
    },
  };
  const result = await runAssessmentRetentionCleanup(db, reports, {
    createId: () => "cleanup-r2-missing",
  });
  assert.deepEqual(deleted, ["missing.json"]);
  assert.equal(result.reportObjectsDeleted, 1);
  assert.equal(result.reportObjectsFailed, 0);
  assert.equal(result.status, "completed");
});
test("retention cleanup writes a partial audit and retains a record when R2 deletion fails", async () => {
  const prepared = [];
  const reports = {
    async delete(key) {
      if (key === "report.pdf") throw new Error("R2 unavailable");
    },
  };
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = { sql, values, run: async () => undefined };
          prepared.push(statement);
          return statement;
        },
      };
    },
    async batch(statements) {
      if (statements.length === 1)
        return [
          {
            results: [
              {
                id: "expired-1",
                report_snapshot_key: "snapshot.json",
                report_pdf_key: "report.pdf",
              },
            ],
          },
        ];
      return [
        { results: [{ count: 0 }] },
        { results: [{ count: 0 }] },
        {},
        {},
        {},
      ];
    },
  };
  const result = await runAssessmentRetentionCleanup(db, reports, {
    createId: () => "cleanup-r2-partial",
  });
  assert.equal(result.reportObjectsDeleted, 1);
  assert.equal(result.reportObjectsFailed, 1);
  assert.equal(result.status, "partial");
  assert.match(prepared.at(-3).values.join(" "), /partial/);
  assert.match(prepared.at(-1).sql, /id NOT IN/i);
  assert.ok(prepared.at(-1).values.includes("expired-1"));
});
test("Cloudflare configuration schedules daily retention cleanup and rate-limits narrative and calculation requests", async () => {
  const config = JSON.parse(
    await readFile(new URL("wrangler.jsonc", projectRoot), "utf8"),
  );
  assert.deepEqual(config.triggers.crons, ["17 3 * * *"]);
  assert.equal(config.ratelimits[0].name, "NARRATIVE_RATE_LIMITER");
  assert.equal(config.ratelimits[0].simple.limit, 3);
  assert.equal(config.ratelimits[0].simple.period, 60);
  const calculationLimiter = config.ratelimits.find(
    (limiter) => limiter.name === "ASSESSMENT_CALCULATION_RATE_LIMITER",
  );
  assert.ok(calculationLimiter);
  assert.equal(calculationLimiter.simple.period, 60);
  assert.ok(calculationLimiter.simple.limit > 0);
  const worker = await readFile(
    new URL("worker/index.ts", projectRoot),
    "utf8",
  );
  assert.match(worker, /scheduled\s*\(/);
  assert.match(worker, /runAssessmentRetentionCleanup/);
});

test("privacy, consent, and operations docs disclose internal narrative email and bounded retention", async () => {
  const [privacy, gate, readme] = await Promise.all([
    readFile(new URL("app/privacy/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/assessment/ContactGate.tsx", projectRoot), "utf8"),
    readFile(new URL("README.md", projectRoot), "utf8"),
  ]);
  for (const source of [privacy, readme]) {
    assert.match(source, /90-day period/i);
    assert.match(source, /normally within 24 hours/i);
    assert.doesNotMatch(source, /up to 90 days/i);
    assert.match(source, /03:17 UTC/i);
    assert.match(source, /info@runrategroup\.com/i);
    assert.match(source, /name.*email.*company.*role/is);
    assert.match(source, /OpenAI.*(?:no|not).*identity.*raw answers/is);
    assert.match(source, /OpenAI.*candidate block IDs/is);
    assert.match(source, /OpenAI.*(?:no|not).*prose/is);
    assert.match(source, /narrative prose.*not.*D1/is);
    assert.match(source, /mailbox/is);
  }
  assert.match(gate, /internal assessment notification/i);
  assert.match(gate, /90-day period/i);
  assert.match(readme, /0007_happy_dust\.sql/i);
  assert.match(readme, /wrangler\.jsonc/i);
  assert.match(readme, /npm run cf:migrate/i);
  assert.match(readme, /role-null\s+records are rejected/i);
});
