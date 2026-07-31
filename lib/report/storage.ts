export type ReportSnapshot = {
  schemaVersion: number;
  assessmentId: string;
  assessmentVersion: string;
  createdAt: string;
  lead: Record<string, unknown>;
  answers: Record<string, unknown>;
  result: Record<string, unknown>;
  narrative: Record<string, unknown>;
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
