import { NextResponse } from "next/server";
import { buildAssessmentResult } from "../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../lib/assessment/validation";

export async function POST(request: Request) {
  const parsed = parseAssessmentPayload(
    await request.json().catch(() => null),
  );
  if (!parsed.ok) {
    return NextResponse.json(parsed, { status: 422 });
  }
  const result = buildAssessmentResult(parsed.answers);
  return NextResponse.json({
    ok: true,
    assessmentId: crypto.randomUUID(),
    result,
  });
}
