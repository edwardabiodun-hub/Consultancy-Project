type D1Result = { meta?: { changes?: number } };
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

const changes = (result: D1Result | undefined): number =>
  Number(result?.meta?.changes ?? 0);

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
  const deleteRelatedEvents = db.prepare(
    "DELETE FROM assessment_events WHERE assessment_id IN (SELECT id FROM assessment_records WHERE created_at < ?)",
  ).bind(cutoff);
  const deleteOldEvents = db.prepare(
    "DELETE FROM assessment_events WHERE created_at < ?",
  ).bind(cutoff);
  const deleteRecords = db.prepare(
    "DELETE FROM assessment_records WHERE created_at < ?",
  ).bind(cutoff);
  const results = await db.batch([deleteRelatedEvents, deleteOldEvents, deleteRecords]);
  const assessmentEventsDeleted = changes(results[0]) + changes(results[1]);
  const assessmentRecordsDeleted = changes(results[2]);
  const id = (options.createId ?? (() => crypto.randomUUID()))();
  await db.prepare(
    "INSERT INTO retention_cleanup_runs (id, cutoff_at, assessment_records_deleted, assessment_events_deleted, status) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, cutoff, assessmentRecordsDeleted, assessmentEventsDeleted, "completed").run();
  return { cutoff, assessmentEventsDeleted, assessmentRecordsDeleted };
}