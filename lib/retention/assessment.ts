type D1Result = {
  meta?: { changes?: number };
  results?: Array<Record<string, unknown>>;
};
type BoundStatement = { run(): Promise<unknown> };
type RetentionDatabase = {
  prepare(sql: string): { bind(...values: unknown[]): BoundStatement };
  batch(statements: BoundStatement[]): Promise<D1Result[]>;
};
type ReportsBucket = { delete(key: string): Promise<void> };
type CleanupOptions = { now?: Date; createId?: () => string };
type ExpiredRecord = {
  id: string;
  report_snapshot_key?: string | null;
  report_pdf_key?: string | null;
};
const sqliteTimestamp = (date: Date): string =>
  date.toISOString().slice(0, 19).replace("T", " ");
const preDeleteCount = (result: D1Result | undefined): number =>
  Number(result?.results?.[0]?.count ?? 0);
const isReportsBucket = (
  value: ReportsBucket | CleanupOptions | undefined,
): value is ReportsBucket =>
  typeof (value as ReportsBucket | undefined)?.delete === "function";
export async function runAssessmentRetentionCleanup(
  db: RetentionDatabase,
  reportsOrOptions: ReportsBucket | CleanupOptions = {},
  suppliedOptions: CleanupOptions = {},
): Promise<{
  cutoff: string;
  assessmentEventsDeleted: number;
  assessmentRecordsDeleted: number;
  reportObjectsDeleted?: number;
  reportObjectsFailed?: number;
  status?: "completed" | "partial";
}> {
  const reports = isReportsBucket(reportsOrOptions) ? reportsOrOptions : undefined;
  const options = reports ? suppliedOptions : reportsOrOptions;
  const now = options.now ?? new Date();
  const cutoff = sqliteTimestamp(
    new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
  );
  const id = (options.createId ?? (() => crypto.randomUUID()))();
  let reportObjectsDeleted = 0;
  let reportObjectsFailed = 0;
  const failedRecordIds: string[] = [];
  if (reports) {
    const expiredRecords = await db.batch([
      db
        .prepare(
          "SELECT id, report_snapshot_key, report_pdf_key FROM assessment_records WHERE created_at < ?",
        )
        .bind(cutoff),
    ]);
    for (const record of (expiredRecords[0]?.results ??
      []) as ExpiredRecord[]) {
      let failed = false;
      for (const key of [record.report_snapshot_key, record.report_pdf_key]) {
        if (!key) continue;
        try {
          await reports.delete(key);
          reportObjectsDeleted += 1;
        } catch {
          reportObjectsFailed += 1;
          failed = true;
        }
      }
      if (failed) failedRecordIds.push(record.id);
    }
  }
  const retainedRecordClause = failedRecordIds.length
    ? ` AND id NOT IN (${failedRecordIds.map(() => "?").join(", ")})`
    : "";
  const recordWhere = `created_at < ?${retainedRecordClause}`;
  const expiredEventsWhere = `created_at < ? OR assessment_id IN (SELECT id FROM assessment_records WHERE ${recordWhere})`;
  const countExpiredEvents = db
    .prepare(
      `SELECT COUNT(*) AS count FROM assessment_events WHERE ${expiredEventsWhere}`,
    )
    .bind(cutoff, cutoff, ...failedRecordIds);
  const countExpiredRecords = db
    .prepare(
      `SELECT COUNT(*) AS count FROM assessment_records WHERE ${recordWhere}`,
    )
    .bind(cutoff, ...failedRecordIds);
  const status: "completed" | "partial" = reportObjectsFailed
    ? "partial"
    : "completed";
  const writeAudit = db
    .prepare(
      `INSERT INTO retention_cleanup_runs (id, cutoff_at, assessment_records_deleted, assessment_events_deleted, report_objects_deleted, report_objects_failed, status) SELECT ?, ?, (SELECT COUNT(*) FROM assessment_records WHERE ${recordWhere}), (SELECT COUNT(*) FROM assessment_events WHERE ${expiredEventsWhere}), ?, ?, ?`,
    )
    .bind(
      id,
      cutoff,
      cutoff,
      ...failedRecordIds,
      cutoff,
      cutoff,
      ...failedRecordIds,
      reportObjectsDeleted,
      reportObjectsFailed,
      status,
    );
  const deleteExpiredEvents = db
    .prepare(`DELETE FROM assessment_events WHERE ${expiredEventsWhere}`)
    .bind(cutoff, cutoff, ...failedRecordIds);
  const deleteExpiredRecords = db
    .prepare(`DELETE FROM assessment_records WHERE ${recordWhere}`)
    .bind(cutoff, ...failedRecordIds);
  const results = await db.batch([
    countExpiredEvents,
    countExpiredRecords,
    writeAudit,
    deleteExpiredEvents,
    deleteExpiredRecords,
  ]);
  const result = {
    cutoff,
    assessmentEventsDeleted: preDeleteCount(results[0]),
    assessmentRecordsDeleted: preDeleteCount(results[1]),
  };
  return reports
    ? { ...result, reportObjectsDeleted, reportObjectsFailed, status }
    : result;
}
