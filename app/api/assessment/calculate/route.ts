import { NextResponse } from "next/server";
import type { assessmentRecords } from "../../../../db/schema";
import { toAssessmentRecord } from "../../../../lib/assessment/record";
import { buildAssessmentResult } from "../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../lib/assessment/validation";

type AssessmentRecord = typeof assessmentRecords.$inferInsert;
type HandlerDependencies = {
  createId: () => string;
  persistRecord: (record: AssessmentRecord) => Promise<void>;
  checkRateLimit: (clientKey: string) => Promise<boolean>;
};

const CALCULATION_RATE_LIMITER = "ASSESSMENT_CALCULATION_RATE_LIMITER";
const FALLBACK_RATE_LIMIT = 60;
const RATE_LIMIT_PERIOD_MS = 60_000;
const fallbackRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const checkFallbackCalculationRateLimit = (clientKey: string, now = Date.now()): boolean => {
  const current = fallbackRateLimitBuckets.get(clientKey);
  if (!current || current.resetAt <= now) {
    fallbackRateLimitBuckets.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_PERIOD_MS });
    return true;
  }
  current.count += 1;
  return current.count <= FALLBACK_RATE_LIMIT;
};

export const getAssessmentCalculationClientKey = (request: Request): string => {
  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();
  return connectingIp ? `ip:${connectingIp}` : "anonymous";
};

const checkAssessmentCalculationRateLimit = async (clientKey: string): Promise<boolean> => {
  let limiter: { limit(input: { key: string }): Promise<{ success: boolean }> } | undefined;
  try {
    const { env } = await import("cloudflare:workers");
    const workerEnv = env as unknown as Record<string, typeof limiter>;
    limiter = workerEnv[CALCULATION_RATE_LIMITER];
  } catch {
    return checkFallbackCalculationRateLimit(clientKey);
  }
  if (!limiter) return checkFallbackCalculationRateLimit(clientKey);
  return (await limiter.limit({ key: clientKey })).success;
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
  const persistRecord = dependencies.persistRecord ?? persistAssessmentRecord;
  const checkRateLimit = dependencies.checkRateLimit ?? (async () => true);

  return async function calculateAssessment(request: Request) {
    const parsed = parseAssessmentPayload(
      await request.json().catch(() => null),
    );
    if (!parsed.ok) {
      return NextResponse.json(parsed, { status: 422 });
    }

    try {
      if (!(await checkRateLimit(getAssessmentCalculationClientKey(request)))) {
        return NextResponse.json(
          { ok: false, error: "Too many assessment requests. Please try again shortly." },
          { status: 429, headers: { "retry-after": "60" } },
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Assessment service is temporarily unavailable." },
        { status: 503 },
      );
    }

    const result = buildAssessmentResult(parsed.answers);
    const assessmentId = createId();
    const record = toAssessmentRecord({
      id: assessmentId,
      lead: parsed.lead,
      result,
      role: parsed.answers.role,
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

export const POST = createAssessmentCalculationHandler({ checkRateLimit: checkAssessmentCalculationRateLimit });