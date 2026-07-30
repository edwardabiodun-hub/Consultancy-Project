type D1Result = {
  meta?: { changes?: number };
  results?: Array<{ count?: number | string }>;
};
type BoundStatement = { run(): Promise<unknown> };
type RetentionDatabase = {
  prepare(sql: string): { bind(...values: unknown[]): BoundStatement };
  batch(statements: BoundStatement[]): Promise<D1Result[]>;
};

type CleanupOptions = {
  now?: Date;
  createId?: () => string;
};

const sqliteTimestamp = (date: Date): string =>
  date.toISOString().slice(0, 19).replace("T", " ");

const preDeleteCount = (result: D1Result | undefined): number =>
  Number(result?.results?.[0]?.count ?? 0);

export async function runAssessmentRetentionCleanup(
  db: RetentionDatabase,
  options: CleanupOptions = {},
): Promise<{
  cutoff: string;
  assessmentEventsDeleted: number;
  assessmentRecordsDeleted: number;
}> {
  const now = options.now ?? new Date();
  const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const cutoff = sqliteTimestamp(cutoffDate);
  const id = (options.createId ?? (() => crypto.randomUUID()))();
  const expiredEventsWhere = "created_at < ? OR assessment_id IN (SELECT id FROM assessment_records WHERE created_at < ?)";

  const countExpiredEvents = db.prepare(
    `SELECT COUNT(*) AS count FROM assessment_events WHERE ${expiredEventsWhere}`,
  ).bind(cutoff, cutoff);
  const countExpiredRecords = db.prepare(
    "SELECT COUNT(*) AS count FROM assessment_records WHERE created_at < ?",
  ).bind(cutoff);
  const writeAudit = db.prepare(
    `INSERT INTO retention_cleanup_runs (id, cutoff_at, assessment_records_deleted, assessment_events_deleted, status)
     SELECT ?, ?,
       (SELECT COUNT(*) FROM assessment_records WHERE created_at < ?),
       (SELECT COUNT(*) FROM assessment_events WHERE ${expiredEventsWhere}),
       ?`,
  ).bind(id, cutoff, cutoff, cutoff, cutoff, "completed");
  const deleteExpiredEvents = db.prepare(
    `DELETE FROM assessment_events WHERE ${expiredEventsWhere}`,
  ).bind(cutoff, cutoff);
  const deleteExpiredRecords = db.prepare(
    "DELETE FROM assessment_records WHERE created_at < ?",
  ).bind(cutoff);

  const results = await db.batch([
    countExpiredEvents,
    countExpiredRecords,
    writeAudit,
    deleteExpiredEvents,
    deleteExpiredRecords,
  ]);

  return {
    cutoff,
    assessmentEventsDeleted: preDeleteCount(results[0]),
    assessmentRecordsDeleted: preDeleteCount(results[1]),
  };
}