import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalJson,
  createReportStorage,
  createReportObjectKeys,
} from "../../lib/report/storage.ts";

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";

const snapshot = {
  schemaVersion: 1,
  assessmentId,
  assessmentVersion: "1.0.0",
  createdAt: "2026-07-30T12:00:00.000Z",
  lead: { company: "Example Company", name: "Eddie Example" },
  answers: { z: 3, a: ["first", "second"] },
  result: { score: 72 },
  narrative: { source: "rules", blocks: ["summary"] },
  pdfObjectKey: `assessments/${assessmentId}/report.pdf`,
};

const createBucket = () => {
  const puts = [];
  const deletes = [];
  return {
    puts,
    deletes,
    bucket: {
      put: async (key, value) => {
        puts.push({ key, value });
      },
      delete: async (keys) => {
        deletes.push(keys);
      },
    },
  };
};

test("snapshot serialization and hash are stable regardless of object insertion order", async () => {
  const reordered = {
    ...snapshot,
    lead: { name: "Eddie Example", company: "Example Company" },
    answers: { a: ["first", "second"], z: 3 },
  };
  assert.equal(canonicalJson(snapshot), canonicalJson(reordered));

  const first = createBucket();
  const second = createBucket();
  const firstStored = await createReportStorage(first.bucket).putSnapshot(snapshot);
  const secondStored = await createReportStorage(second.bucket).putSnapshot(reordered);
  assert.equal(firstStored.snapshotHash, secondStored.snapshotHash);
});

test("report object keys are scoped to the assessment", async () => {
  const keys = createReportObjectKeys(assessmentId);
  assert.equal(keys.snapshotKey, `assessments/${assessmentId}/snapshot.json`);
  assert.equal(keys.pdfKey, `assessments/${assessmentId}/report.pdf`);

  const storage = createReportStorage(createBucket().bucket);
  const stored = await storage.putSnapshot(snapshot);
  assert.equal(stored.snapshotKey, keys.snapshotKey);
  await assert.rejects(
    () => storage.putPdf("reports/unscoped.pdf", new Uint8Array([1])),
    /assessment-scoped/i,
  );
});

test("deleting report objects is idempotent", async () => {
  const adapter = createBucket();
  const storage = createReportStorage(adapter.bucket);
  const keys = createReportObjectKeys(assessmentId);

  await storage.deleteReportObjects(keys);
  await storage.deleteReportObjects(keys);

  assert.deepEqual(adapter.deletes, [
    [keys.snapshotKey, keys.pdfKey],
    [keys.snapshotKey, keys.pdfKey],
  ]);
});
