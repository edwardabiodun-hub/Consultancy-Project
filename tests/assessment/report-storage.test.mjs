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

test("canonical serialization orders object keys by Unicode code unit", () => {
  assert.equal(canonicalJson({ a: 1, B: 2 }), '{"B":2,"a":1}');
});

test("stored PDF retrieval validates the retained SHA-256 hash", async () => {
  const reportStorageModule = await import("../../lib/report/storage.ts");
  assert.equal(typeof reportStorageModule.readStoredReportPdf, "function");
  const bucket = {
    get: async () => ({
      arrayBuffer: async () => Uint8Array.from([37, 80, 68, 70]).buffer,
    }),
  };

  assert.deepEqual(
    await reportStorageModule.readStoredReportPdf(
      bucket,
      `assessments/${assessmentId}/report.pdf`,
      "not-the-real-hash",
    ),
    { status: "hash_mismatch" },
  );
});

test("full report persistence stores one PDF, a complete snapshot, and D1 hashes", async () => {
  const reportStorageModule = await import("../../lib/report/storage.ts");
  assert.equal(typeof reportStorageModule.persistFullReportSnapshot, "function");
  const calls = { snapshots: [], pdfs: [], metadata: [], builds: 0 };
  const reportStorage = {
    putSnapshot: async (value) => {
      calls.snapshots.push(value);
      return { snapshotKey: `assessments/${assessmentId}/snapshot.json`, snapshotHash: "snapshot-hash" };
    },
    putPdf: async (key, bytes) => {
      calls.pdfs.push({ key, bytes });
      return { pdfKey: key, pdfHash: "pdf-hash" };
    },
    deleteReportObjects: async () => {},
  };
  const input = {
    assessmentId,
    assessmentVersion: "1.0.0",
    createdAt: "2026-07-30T12:00:00.000Z",
    lead: { name: "Eddie", reportConsent: true },
    answers: { role: "Owner-operator" },
    result: { score: { overall: 72 } },
    narrative: { source: "ai", text: "Accepted closed-set narrative" },
    reportRecord: { id: assessmentId },
  };

  await reportStorageModule.persistFullReportSnapshot(input, {
    reportStorage,
    buildPdf: async () => {
      calls.builds += 1;
      return new Uint8Array([37, 80, 68, 70]);
    },
    updateMetadata: async (metadata) => calls.metadata.push(metadata),
    now: () => new Date("2026-07-30T12:01:00.000Z"),
  });

  assert.equal(calls.builds, 1);
  assert.deepEqual(calls.snapshots, [{
    schemaVersion: 1,
    assessmentId,
    assessmentVersion: "1.0.0",
    createdAt: "2026-07-30T12:00:00.000Z",
    lead: input.lead,
    answers: input.answers,
    result: input.result,
    narrative: input.narrative,
    pdfObjectKey: `assessments/${assessmentId}/report.pdf`,
  }]);
  assert.equal(calls.pdfs.length, 1);
  assert.equal(calls.pdfs[0].key, `assessments/${assessmentId}/report.pdf`);
  assert.deepEqual(calls.metadata, [{
    reportSnapshotKey: `assessments/${assessmentId}/snapshot.json`,
    reportPdfKey: `assessments/${assessmentId}/report.pdf`,
    reportSnapshotHash: "snapshot-hash",
    reportPdfHash: "pdf-hash",
    reportStorageStatus: "stored",
    reportStoredAt: "2026-07-30T12:01:00.000Z",
  }]);
});

test("a recovered report storage claim removes deterministic orphan keys before writing", async () => {
  const reportStorageModule = await import("../../lib/report/storage.ts");
  const calls = [];
  const keys = createReportObjectKeys(assessmentId);
  const reportStorage = {
    deleteReportObjects: async (value) => calls.push(["delete", value]),
    putPdf: async (key) => {
      calls.push(["put-pdf", key]);
      return { pdfKey: key, pdfHash: "pdf-hash" };
    },
    putSnapshot: async () => {
      calls.push(["put-snapshot", keys.snapshotKey]);
      return { snapshotKey: keys.snapshotKey, snapshotHash: "snapshot-hash" };
    },
  };

  await reportStorageModule.persistFullReportSnapshot({
    assessmentId,
    assessmentVersion: "1.0.0",
    createdAt: "2026-07-30T12:00:00.000Z",
    lead: {}, answers: {}, result: {}, narrative: {}, reportRecord: {},
  }, {
    reportStorage,
    buildPdf: async () => new Uint8Array([37, 80, 68, 70]),
    updateMetadata: async () => {},
    ownsClaim: async () => true,
  });

  assert.deepEqual(calls, [
    ["delete", keys],
    ["put-pdf", keys.pdfKey],
    ["put-snapshot", keys.snapshotKey],
  ]);
});

test("full report persistence records storage_failed after an object write fails", async () => {
  const reportStorageModule = await import("../../lib/report/storage.ts");
  const metadata = [];
  const reportStorage = {
    putSnapshot: async () => { throw new Error("R2 unavailable"); },
    putPdf: async (key) => ({ pdfKey: key, pdfHash: "pdf-hash" }),
    deleteReportObjects: async () => {},
  };

  await assert.rejects(
    () => reportStorageModule.persistFullReportSnapshot({
      assessmentId,
      assessmentVersion: "1.0.0",
      createdAt: "2026-07-30T12:00:00.000Z",
      lead: {}, answers: {}, result: {}, narrative: {}, reportRecord: {},
    }, {
      reportStorage,
      buildPdf: async () => new Uint8Array([37, 80, 68, 70]),
      updateMetadata: async (value) => metadata.push(value),
    }),
    /R2 unavailable/,
  );
  assert.deepEqual(metadata, [{ reportStorageStatus: "storage_failed", reportStoredAt: null }]);
});

test("stored PDF retrieval returns bytes only when the real SHA-256 matches", async () => {
  const reportStorageModule = await import("../../lib/report/storage.ts");
  const bytes = Uint8Array.from([37, 80, 68, 70, 45, 109, 97, 116, 99, 104]);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const bucket = { get: async () => ({ arrayBuffer: async () => bytes.buffer }) };

  const result = await reportStorageModule.readStoredReportPdf(
    bucket,
    `assessments/${assessmentId}/report.pdf`,
    hash,
  );
  assert.equal(result.status, "found");
  assert.deepEqual(result.bytes, bytes);
});

test("a persistence attempt that lost its claim never deletes another attempt's objects", async () => {
  const reportStorageModule = await import("../../lib/report/storage.ts");
  let deleteCount = 0;
  const reportStorage = {
    putPdf: async (key) => ({ pdfKey: key, pdfHash: "pdf-hash" }),
    putSnapshot: async () => { throw new Error("late failure"); },
    deleteReportObjects: async () => { deleteCount += 1; },
  };

  await assert.rejects(
    () => reportStorageModule.persistFullReportSnapshot({
      assessmentId,
      assessmentVersion: "1.0.0",
      createdAt: "2026-07-30T12:00:00.000Z",
      lead: {}, answers: {}, result: {}, narrative: {}, reportRecord: {},
    }, {
      reportStorage,
      buildPdf: async () => new Uint8Array([37, 80, 68, 70]),
      updateMetadata: async () => {},
      ownsClaim: async () => false,
    }),
    /claim lost/i,
  );
  assert.equal(deleteCount, 0);
});
