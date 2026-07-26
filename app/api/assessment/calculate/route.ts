import { NextResponse } from "next/server";
import type { assessmentRecords } from "../../../../db/schema";
import { toAssessmentRecord } from "../../../../lib/assessment/record";
import { buildAssessmentResult } from "../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../lib/assessment/validation";

type AssessmentRecord = typeof assessmentRecords.$inferInsert;
type HandlerDependencies = {
  createId: () => string;
  persistRecord: (record: AssessmentRecord) => Promise<void>;
};

const persistAssessmentRecord = async (record: AssessmentRecord) => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../db"),
    import("../../../../db/schema"),
  ]);
  await getDb().insert(assessmentRecords).values(record);
};

export function createAssessmentCalculationHandler(
  dependencies: Partial<HandlerDependencies> = {},
) {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const persistRecord =
    dependencies.persistRecord ?? persistAssessmentRecord;

  return async function calculateAssessment(request: Request) {
    const parsed = parseAssessmentPayload(
      await request.json().catch(() => null),
    );
    if (!parsed.ok) {
      return NextResponse.json(parsed, { status: 422 });
    }

    const result = buildAssessmentResult(parsed.answers);
    const assessmentId = createId();
    const record = toAssessmentRecord({
      id: assessmentId,
      lead: parsed.lead,
      result,
    });

    let persistenceAvailable = true;
    try {
      await persistRecord(record);
    } catch {
      persistenceAvailable = false;
    }

    return NextResponse.json({
      ok: true,
      assessmentId,
      result,
      persistenceAvailable,
    });
  };
}

export const POST = createAssessmentCalculationHandler();
