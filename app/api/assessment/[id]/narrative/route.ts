import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { buildAssessmentResult } from "../../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../../lib/assessment/validation";
import {
  generateValidatedNarrative,
  type NarrativeOutcome,
} from "../../../../../lib/assessment/narrative";

type RouteContext = { params: Promise<{ id: string }> };
type HandlerDependencies = {
  generateNarrative: typeof generateValidatedNarrative;
  updateNarrativeSource: (
    id: string,
    source: NarrativeOutcome["source"],
  ) => Promise<void>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
};

const notFound = () =>
  new Response("Assessment record not found.", {
    status: 404,
    headers: PRIVATE_HEADERS,
  });

// Best-effort update of the single existing `narrativeSource` column for a
// previously persisted record. No schema change and no narrative prose is
// ever written to D1 - only which source ("ai" or "rules") was accepted, per
// the reviewed privacy disclosures in lib/report/pdf.ts and app/privacy.
const updateStoredNarrativeSource = async (
  id: string,
  source: NarrativeOutcome["source"],
) => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"),
    import("../../../../../db/schema"),
  ]);
  await getDb()
    .update(assessmentRecords)
    .set({ narrativeSource: source })
    .where(eq(assessmentRecords.id, id));
};

export function createAssessmentNarrativeHandler(
  dependencies: Partial<HandlerDependencies> = {},
) {
  const generateNarrative =
    dependencies.generateNarrative ?? generateValidatedNarrative;
  const updateNarrativeSource =
    dependencies.updateNarrativeSource ?? updateStoredNarrativeSource;

  return async function postAssessmentNarrative(
    request: Request,
    context: RouteContext,
  ) {
    const { id } = await context.params;
    if (!UUID.test(id)) return notFound();

    const parsed = parseAssessmentPayload(
      await request.json().catch(() => null),
    );
    if (!parsed.ok) {
      return NextResponse.json(parsed, {
        status: 422,
        headers: PRIVATE_HEADERS,
      });
    }

    // Recompute the deterministic result server-side from the posted
    // answers - never trust a client-supplied result - matching the
    // /api/assessment/calculate pattern. `parsed.lead` (contact/consent
    // fields) is intentionally never read here or forwarded to the model.
    const result = buildAssessmentResult(parsed.answers);

    const narrative = await generateNarrative(result, {
      employeeBand: parsed.answers.employeeBand,
      revenueBand: parsed.answers.revenueBand,
      role: parsed.answers.role,
      restrictedMarket: parsed.answers.restrictedMarket,
    });

    let persistenceAvailable = true;
    try {
      await updateNarrativeSource(id, narrative.source);
    } catch {
      persistenceAvailable = false;
    }

    return NextResponse.json(
      { ok: true, narrative, persistenceAvailable },
      { headers: PRIVATE_HEADERS },
    );
  };
}

export const POST = createAssessmentNarrativeHandler();
