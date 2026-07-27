import { NextResponse } from "next/server";
import type { assessmentEvents } from "../../../../db/schema";
import { parseAssessmentEventPayload } from "../../../../lib/analytics/assessment";

type AssessmentEventRecord = typeof assessmentEvents.$inferInsert;
type HandlerDependencies = {
  createId: () => string;
  persistEvent: (record: AssessmentEventRecord) => Promise<void>;
};

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
};

const persistAssessmentEvent = async (record: AssessmentEventRecord) => {
  const [{ getDb }, { assessmentEvents }] = await Promise.all([
    import("../../../../db"),
    import("../../../../db/schema"),
  ]);
  await getDb().insert(assessmentEvents).values(record);
};

export function createAssessmentEventHandler(
  dependencies: Partial<HandlerDependencies> = {},
) {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const persistEvent = dependencies.persistEvent ?? persistAssessmentEvent;

  return async function postAssessmentEvent(request: Request) {
    const parsed = parseAssessmentEventPayload(
      await request.json().catch(() => null),
    );
    if (!parsed.ok) {
      return NextResponse.json(parsed, {
        status: 422,
        headers: PRIVATE_HEADERS,
      });
    }

    // Only ever forward the allowlisted, already-validated fields into
    // storage - never the raw request body - so an unexpected key cannot
    // reach the database even if validation is ever loosened upstream.
    const record: AssessmentEventRecord = {
      id: createId(),
      eventName: parsed.event.eventName,
      assessmentId: parsed.event.assessmentId ?? null,
      screen: parsed.event.screen ?? null,
      resultCategory: parsed.event.resultCategory ?? null,
      scoreConfidence: parsed.event.scoreConfidence ?? null,
      impactConfidence: parsed.event.impactConfidence ?? null,
      route: parsed.event.route ?? null,
    };

    let persistenceAvailable = true;
    try {
      await persistEvent(record);
    } catch {
      persistenceAvailable = false;
    }

    return NextResponse.json(
      { ok: true, persistenceAvailable },
      { status: 202, headers: PRIVATE_HEADERS },
    );
  };
}

export const POST = createAssessmentEventHandler();
