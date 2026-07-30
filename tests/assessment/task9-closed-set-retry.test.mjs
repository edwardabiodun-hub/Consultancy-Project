import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import {
  buildNarrativeModelInput,
  resolveNarrativeSelection,
} from "../../lib/assessment/narrative.ts";
import {
  createAssessmentNarrativeHandler,
} from "../../app/api/assessment/[id]/narrative/route.ts";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { toAssessmentRecord } from "../../lib/assessment/record.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";
const answers = {
  employeeBand: "20-49",
  managerBand: "3-5",
  revenueBand: "5m-20m",
  role: "Owner-operator",
  coreSystemCount: "twoOrMore",
  organizationShape: "multipleTeams",
  relationshipLedByOwner: true,
  restrictedMarket: false,
  scored: Object.fromEntries(QUESTION_BANK.map((question) => [question.id, 50])),
  capacity: { source: "none", activities: [] },
};
const lead = {
  name: "Avery Founder",
  workEmail: "avery@example.com",
  company: "Example Operations",
  phone: "843-555-0100",
  reportConsent: true,
  marketingConsent: false,
};
const result = buildAssessmentResult(answers);
const allowed = buildNarrativeModelInput(result).allowedBlockIds;
const selection = {
  summaryId: allowed.summaries[0],
  observationIds: allowed.observations.slice(0, 2),
  priorityId: allowed.priorities[0],
  limitationsId: allowed.limitations[0],
};
const localNarrativeText = resolveNarrativeSelection(selection, result);
const request = () => new Request(
  `https://example.com/api/assessment/${assessmentId}/narrative`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers, lead }),
  },
);
const context = { params: Promise.resolve({ id: assessmentId }) };

const createStoredRecord = () => ({
  ...toAssessmentRecord({ id: assessmentId, lead, result, role: answers.role }),
  createdAt: "2026-07-29 12:00:00",
});

const createStatefulDependencies = (overrides = {}) => {
  const record = createStoredRecord();
  let narrativeAttempts = 0;
  return {
    record,
    dependencies: {
      findRecord: async () => ({ ...record }),
      checkRateLimit: async () => true,
      checkGlobalRateLimit: async () => true,
      isNarrativeModelConfigured: () => true,
      claimNarrativeAttempt: async () => {
        narrativeAttempts += 1;
        return narrativeAttempts === 1 ? "claimed" : "already_attempted";
      },
      generateNarrative: async () => ({
        source: "ai",
        text: localNarrativeText,
        selection,
      }),
      updateNarrativeSource: async (_id, source, acceptedSelection) => {
        record.narrativeSource = source;
        record.narrativeSelectionJson = acceptedSelection
          ? JSON.stringify(acceptedSelection)
          : null;
      },
      finalizeInternalNotification: async () => {},
      sendInternalNotification: async () => ({ accepted: true }),
      ...overrides,
    },
  };
};

test("an AI-first definitive notification failure retries with identical local prose and payload hash", async () => {
  const hashes = [];
  const narratives = [];
  let notificationState = "pending";
  let sends = 0;
  const fixture = createStatefulDependencies({
    fingerprintInternalNotification: async (input) => {
      narratives.push(input.narrative);
      return JSON.stringify(input);
    },
    claimInternalNotification: async (_id, hash) => {
      hashes.push(hash);
      if (notificationState === "sent") return "sent";
      notificationState = "sending";
      return "claimed";
    },
    finalizeInternalNotification: async (_id, outcome) => {
      notificationState = outcome;
    },
    sendInternalNotification: async () => {
      sends += 1;
      return sends === 1
        ? { accepted: false, retryable: true }
        : { accepted: true };
    },
  });
  const handler = createAssessmentNarrativeHandler(fixture.dependencies);

  assert.equal((await (await handler(request(), context)).json()).internalNotificationAccepted, false);
  assert.equal((await (await handler(request(), context)).json()).internalNotificationAccepted, true);

  assert.equal(sends, 2);
  assert.equal(hashes[0], hashes[1]);
  assert.deepEqual(narratives[0], narratives[1]);
  assert.deepEqual(narratives[1], { source: "ai", text: localNarrativeText });
  assert.equal(fixture.record.narrativeSelectionJson, JSON.stringify(selection));
  assert.doesNotMatch(fixture.record.narrativeSelectionJson, /self-reported|management|audit/i);
});

test("an AI-first stale notification claim is reclaimed with the identical payload hash", async () => {
  const hashes = [];
  const sentNarratives = [];
  let claimCount = 0;
  const fixture = createStatefulDependencies({
    fingerprintInternalNotification: async (input) => JSON.stringify(input),
    claimInternalNotification: async (_id, hash) => {
      hashes.push(hash);
      claimCount += 1;
      return claimCount === 1 ? "busy" : "claimed";
    },
    sendInternalNotification: async (input) => {
      sentNarratives.push(input.narrative);
      return { accepted: true };
    },
  });
  const handler = createAssessmentNarrativeHandler(fixture.dependencies);

  assert.equal((await (await handler(request(), context)).json()).internalNotificationAccepted, false);
  assert.equal((await (await handler(request(), context)).json()).internalNotificationAccepted, true);

  assert.equal(hashes[0], hashes[1]);
  assert.deepEqual(sentNarratives, [{ source: "ai", text: localNarrativeText }]);
});

test("a global OpenAI limiter rejection still sends the rules notification", async () => {
  let generated = false;
  let sentNarrative = null;
  const record = createStoredRecord();
  const handler = createAssessmentNarrativeHandler({
    findRecord: async () => record,
    checkRateLimit: async () => true,
    checkGlobalRateLimit: async () => false,
    isNarrativeModelConfigured: () => true,
    claimNarrativeAttempt: async () => "claimed",
    generateNarrative: async () => {
      generated = true;
      return { source: "ai", text: localNarrativeText, selection };
    },
    updateNarrativeSource: async () => {},
    fingerprintInternalNotification: async () => "rules-hash",
    claimInternalNotification: async () => "claimed",
    finalizeInternalNotification: async () => {},
    sendInternalNotification: async (input) => {
      sentNarrative = input.narrative;
      return { accepted: true };
    },
  });

  const body = await (await handler(request(), context)).json();

  assert.equal(generated, false);
  assert.deepEqual(sentNarrative, {
    source: "rules",
    text: result.narrative.summary,
  });
  assert.equal(body.internalNotificationAccepted, true);
});

test("new compact records initialize closed-set narrative selection storage without prose", () => {
  const compact = toAssessmentRecord({ id: assessmentId, lead, result, role: answers.role });
  assert.equal(compact.narrativeSelectionJson, null);
});
test("a generated migration adds nullable closed-set selection storage only", async () => {
  const migrationRoot = new URL("../../drizzle/", import.meta.url);
  const files = (await readdir(migrationRoot)).filter((name) => name.endsWith(".sql"));
  const migrations = await Promise.all(
    files.map(async (name) => readFile(new URL(name, migrationRoot), "utf8")),
  );
  const selectionMigration = migrations.find((sql) => /ADD `narrative_selection_json` text/i.test(sql));

  assert.ok(selectionMigration, "expected a generated narrative_selection_json migration");
  assert.match(selectionMigration, /ADD `narrative_selection_json` text;/i);
  assert.doesNotMatch(selectionMigration, /narrative_selection_json[^;]*NOT NULL/i);
  assert.doesNotMatch(selectionMigration, /narrative_selection_(?:text|prose)/i);
});
