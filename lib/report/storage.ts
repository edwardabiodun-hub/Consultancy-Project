import type { AssessmentAnswers } from "../assessment/types";
import type { AssessmentResult } from "../assessment/result";
import type { AssessmentLead } from "../assessment/validation";
import type { NarrativeOutcome } from "../assessment/narrative";
import { buildAssessmentPdf, type AssessmentReportRecord } from "./pdf";

export type ReportSnapshot = {
  schemaVersion: number;
  assessmentId: string;
  assessmentVersion: string;
  createdAt: string;
  lead: object;
  answers: object;
  result: object;
  narrative: object;
  pdfObjectKey: string;
};

export type ReportObjectKeys = {
  snapshotKey: string;
  pdfKey: string;
};

export type ReportStorage = {
  putSnapshot(
    snapshot: ReportSnapshot,
  ): Promise<{ snapshotKey: string; snapshotHash: string }>;
  putPdf(
    objectKey: string,
    bytes: Uint8Array,
  ): Promise<{ pdfKey: string; pdfHash: string }>;
  deleteReportObjects(keys: ReportObjectKeys): Promise<void>;
};

type ReportBucket = {
  put(key: string, value: string | Uint8Array): Promise<unknown>;
  delete(keys: string[]): Promise<unknown>;
};

export type ReportStorageMetadata = {
  reportSnapshotKey?: string;
  reportPdfKey?: string;
  reportSnapshotHash?: string;
  reportPdfHash?: string;
  reportStorageStatus: "stored" | "storage_failed";
  reportStoredAt: string | null;
};

export type PersistFullReportSnapshotInput = {
  assessmentId: string;
  assessmentVersion: string;
  createdAt: string;
  lead: AssessmentLead;
  answers: AssessmentAnswers;
  result: AssessmentResult;
  narrative: NarrativeOutcome;
  reportRecord: AssessmentReportRecord;
};

type PersistFullReportSnapshotDependencies = {
  reportStorage: ReportStorage;
  buildPdf?: typeof buildAssessmentPdf;
  updateMetadata: (metadata: ReportStorageMetadata) => Promise<void>;
  now?: () => Date;
  ownsClaim?: () => Promise<boolean>;
};

export type StoredPdfLoadResult =
  | { status: "found"; bytes: Uint8Array }
  | { status: "missing" | "unavailable" | "hash_mismatch" };

export type ReportReadBucket = {
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
};

const encoder = new TextEncoder();
const assessmentObjectPrefix = "assessments/";
const validAssessmentId = /^[a-zA-Z0-9-]+$/;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalValue(item)));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }

  return value;
}

/** Produces stable JSON for report content without emitting it to logs. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digestBytes = new Uint8Array(bytes.byteLength);
  digestBytes.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestBytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertAssessmentId(assessmentId: string): void {
  if (!validAssessmentId.test(assessmentId)) {
    throw new Error("Assessment ID must be safe for assessment-scoped object keys");
  }
}

function assertPdfObjectKey(objectKey: string): void {
  if (!/^assessments\/[a-zA-Z0-9-]+\/report\.pdf$/.test(objectKey)) {
    throw new Error("PDF object key must be assessment-scoped");
  }
}

export function createReportObjectKeys(assessmentId: string): ReportObjectKeys {
  assertAssessmentId(assessmentId);
  const prefix = `${assessmentObjectPrefix}${assessmentId}`;
  return {
    snapshotKey: `${prefix}/snapshot.json`,
    pdfKey: `${prefix}/report.pdf`,
  };
}

export function createReportStorage(bucket: ReportBucket): ReportStorage {
  return {
    async putSnapshot(snapshot) {
      const keys = createReportObjectKeys(snapshot.assessmentId);
      if (snapshot.pdfObjectKey !== keys.pdfKey) {
        throw new Error("Snapshot PDF object key must be assessment-scoped to the same assessment");
      }
      const serialized = canonicalJson(snapshot);
      const bytes = encoder.encode(serialized);
      const snapshotHash = await sha256(bytes);
      await bucket.put(keys.snapshotKey, serialized);
      return { snapshotKey: keys.snapshotKey, snapshotHash };
    },

    async putPdf(objectKey, bytes) {
      assertPdfObjectKey(objectKey);
      const pdfHash = await sha256(bytes);
      await bucket.put(objectKey, bytes);
      return { pdfKey: objectKey, pdfHash };
    },

    async deleteReportObjects(keys) {
      assertPdfObjectKey(keys.pdfKey);
      const expected = createReportObjectKeys(
        keys.pdfKey.slice(assessmentObjectPrefix.length, -"/report.pdf".length),
      );
      if (keys.snapshotKey !== expected.snapshotKey || keys.pdfKey !== expected.pdfKey) {
        throw new Error("Report object keys must be assessment-scoped to the same assessment");
      }
      await bucket.delete([keys.snapshotKey, keys.pdfKey]);
    },
  };
}

export async function readStoredReportPdf(
  bucket: ReportReadBucket,
  objectKey: string,
  expectedHash: string,
): Promise<StoredPdfLoadResult> {
  assertPdfObjectKey(objectKey);
  let object: Awaited<ReturnType<ReportReadBucket["get"]>>;
  try {
    object = await bucket.get(objectKey);
  } catch {
    return { status: "unavailable" };
  }
  if (!object) return { status: "missing" };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await object.arrayBuffer());
  } catch {
    return { status: "unavailable" };
  }
  return (await sha256(bytes)) === expectedHash
    ? { status: "found", bytes }
    : { status: "hash_mismatch" };
}

export async function persistFullReportSnapshot(
  input: PersistFullReportSnapshotInput,
  dependencies: PersistFullReportSnapshotDependencies,
): Promise<ReportStorageMetadata> {
  const keys = createReportObjectKeys(input.assessmentId);
  const snapshot: ReportSnapshot = {
    schemaVersion: 1,
    assessmentId: input.assessmentId,
    assessmentVersion: input.assessmentVersion,
    createdAt: input.createdAt,
    lead: input.lead,
    answers: input.answers,
    result: input.result,
    narrative: input.narrative,
    pdfObjectKey: keys.pdfKey,
  };
  const buildPdf = dependencies.buildPdf ?? buildAssessmentPdf;

  try {
    const pdfBytes = await buildPdf(input.reportRecord);
    const pdf = await dependencies.reportStorage.putPdf(keys.pdfKey, pdfBytes);
    const storedSnapshot = await dependencies.reportStorage.putSnapshot(snapshot);
    const metadata: ReportStorageMetadata = {
      reportSnapshotKey: storedSnapshot.snapshotKey,
      reportPdfKey: pdf.pdfKey,
      reportSnapshotHash: storedSnapshot.snapshotHash,
      reportPdfHash: pdf.pdfHash,
      reportStorageStatus: "stored",
      reportStoredAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    };
    if (dependencies.ownsClaim && !(await dependencies.ownsClaim())) {
      throw new Error("Report storage claim lost before finalization");
    }
    await dependencies.updateMetadata(metadata);
    return metadata;
  } catch (error) {
    let ownsClaim = true;
    if (dependencies.ownsClaim) {
      try {
        ownsClaim = await dependencies.ownsClaim();
      } catch {
        ownsClaim = false;
      }
    }
    if (ownsClaim) {
      try {
        await dependencies.reportStorage.deleteReportObjects(keys);
      } catch {
        // Best-effort cleanup: storage_failed remains authoritative in D1.
      }
      try {
        await dependencies.updateMetadata({
          reportStorageStatus: "storage_failed",
          reportStoredAt: null,
        });
      } catch {
        // Preserve the original storage failure for the caller.
      }
    }
    throw error;
  }
}
