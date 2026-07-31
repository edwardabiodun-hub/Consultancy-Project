import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { ComponentId } from "../assessment/types";

import type { AssessmentResult } from "../assessment/result";
import type { AssessmentLead } from "../assessment/validation";
import type { NarrativeOutcome } from "../assessment/narrative";
import { toAssessmentRecord } from "../assessment/record";
export type AssessmentReportRecord = {
  id: string;
  assessmentVersion: string;
  createdAt: string;
  name: string | null;
  company: string | null;
  overallScore: number | null;
  ownerIndependenceScore: number | null;
  operatingSystemScore: number | null;
  informationVisibilityScore: number | null;
  scoreCoverage: number;
  scoreConfidence: string;
  impactConfidence: string;
  estimateType: string;
  capacityInputSource: string;
  ownerGrossHours: number;
  reportingGrossHours: number;
  reworkGrossHours: number;
  grossCapacityValue: number | null;
  realizationFactorLow: number | null;
  realizationFactorHigh: number | null;
  recoverableHoursLow: number | null;
  recoverableHoursHigh: number | null;
  annualValueLow: number | null;
  annualValueHigh: number | null;
  findingsJson: string;
  capacityAssumptionCodesJson: string;
  capacityExclusionCodesJson: string;
  priorityIdsJson: string;
  leadRoute: string;
  narrativeSource: string;
  reportPdfKey?: string | null;
  reportPdfHash?: string | null;
};

export function createAssessmentReportRecord(input: {
  id: string;
  createdAt: string;
  lead: AssessmentLead;
  result: AssessmentResult;
  role: string;
  narrative: NarrativeOutcome;
}): AssessmentReportRecord {
  const compact = toAssessmentRecord({
    id: input.id,
    lead: input.lead,
    result: input.result,
    role: input.role,
  });
  return {
    ...compact,
    createdAt: input.createdAt,
    narrativeSource: input.narrative.source,
  };
}

const PAGE = { width: 612, height: 792, margin: 54 };
const CONTENT_FLOOR = 58;
const COLORS = {
  paper: rgb(0.984, 0.980, 0.965),
  ink: rgb(0.094, 0.137, 0.118),
  forest: rgb(0.09, 0.247, 0.196),
  bronze: rgb(0.604, 0.412, 0.227),
  muted: rgb(0.35, 0.39, 0.36),
  rule: rgb(0.79, 0.77, 0.72),
};

type Fonts = {
  body: PDFFont;
  bodyBold: PDFFont;
  display: PDFFont;
  displayBold: PDFFont;
};

type DrawContext = {
  page: PDFPage;
  fonts: Fonts;
  y: number;
  truncated: boolean;
};

type Finding = {
  code: string;
  kind: "risk" | "watchpoint" | "strength";
  component: ComponentId | null;
};

type ComponentDefinition = {
  label: string;
  scoreKey:
    | "ownerIndependenceScore"
    | "operatingSystemScore"
    | "informationVisibilityScore";
  implication: string;
};

const COMPONENTS: Record<ComponentId, ComponentDefinition> = {
  ownerIndependence: {
    label: "Owner independence",
    scoreKey: "ownerIndependenceScore",
    implication: "Unresolved owner dependence can delay routine decisions and exception handling.",
  },
  operatingSystem: {
    label: "Operating-system maturity",
    scoreKey: "operatingSystemScore",
    implication: "Operating inconsistency can increase rework, handoff friction, and management intervention.",
  },
  informationVisibility: {
    label: "Information visibility",
    scoreKey: "informationVisibilityScore",
    implication: "Information gaps can delay detection, decisions, and corrective action.",
  },
};

const PRIORITIES: Record<
  ComponentId,
  { title: string; action: string; indicator: string }
> = {
  ownerIndependence: {
    title: "Clarify decision authority",
    action: "Define recurring decisions managers can make and the conditions requiring escalation.",
    indicator: "Routine decisions resolved without owner intervention",
  },
  operatingSystem: {
    title: "Stabilize one critical workflow",
    action: "Assign an accountable owner and document decision points, handoffs, and exceptions.",
    indicator: "Exceptions resolved through the documented workflow",
  },
  informationVisibility: {
    title: "Create a decision-ready KPI cadence",
    action: "Standardize measures, definitions, owners, and review actions used for decisions.",
    indicator: "Reviews completed with agreed data and owned actions",
  },
};

export const ROUTES: Record<
  string,
  { label: string; path: string; reason: string }
> = {
  diagnostic: {
    label: "Discuss the Business Independence Diagnostic",
    path: "/diagnostic",
    reason: "The retained dependency profile supports a focused diagnostic conversation.",
  },
  nurture: {
    label: "Get the 90-Day Business Independence Checklist",
    path: "/founder-resources",
    reason: "Build operating discipline before considering a diagnostic.",
  },
  insights: {
    label: "Explore executive operating insights",
    path: "/founder-resources",
    reason: "Protect and extend the operating independence already indicated.",
  },
  restricted: {
    label: "Explore educational founder resources",
    path: "/founder-resources",
    reason: "The retained professional boundary limits the next step to education.",
  },
};

const ASSUMPTIONS: Record<string, string> = {
  exclusive_category_assignment:
    "Each activity is assigned to one category; reporting corrections are not double-counted as rework.",
  exact_inputs: "Time, frequency, people, and cost values were entered as exact inputs.",
  banded_midpoints:
    "Selected self-reported ranges use their disclosed midpoints; they are not external benchmarks.",
  realization_50_70:
    "A 50 to 70 percent realization range is applied to eligible exact-input capacity.",
  realization_35_55:
    "A 35 to 55 percent realization range is applied to eligible banded-input capacity.",
};

const EXCLUSIONS: Record<string, string> = {
  no_capacity_inputs: "No eligible capacity inputs were retained.",
  insufficient_eligible_categories:
    "Fewer than two complete eligible capacity categories were retained.",
  invalid_activity_excluded:
    "One or more incomplete or invalid activities were excluded.",
  duplicate_activity_id:
    "Duplicate activity identifiers caused the capacity estimate to be rejected.",
};

const FINDING_LABELS: Record<string, string> = {
  owner_bottleneck: "Owner decision concentration",
  owner_independence_watchpoint: "Owner independence watchpoint",
  owner_independence_strength: "Owner independence strength",
  operating_system_gap: "Operating-system inconsistency",
  operating_system_watchpoint: "Operating-system watchpoint",
  operating_system_strength: "Operating-system strength",
  information_bottleneck: "Information visibility gap",
  information_visibility_watchpoint: "Information visibility watchpoint",
  information_visibility_strength: "Information visibility strength",
  measurement_gap: "Measurement gap",
};

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const sanitize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseArray = <Value>(value: string): Value[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Value[]) : [];
  } catch {
    return [];
  }
};

const splitToken = (
  token: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) => {
  const parts: string[] = [];
  let remaining = token;
  while (remaining) {
    let part = "";
    for (const character of remaining) {
      if (font.widthOfTextAtSize(part + character, size) > maxWidth) break;
      part += character;
    }
    if (!part) part = remaining[0];
    parts.push(part);
    remaining = remaining.slice(part.length);
  }
  return parts;
};

const wrapLines = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) => {
  const tokens = sanitize(text)
    .split(" ")
    .filter(Boolean)
    .flatMap((token) =>
      font.widthOfTextAtSize(token, size) <= maxWidth
        ? [token]
        : splitToken(token, font, size, maxWidth),
    );
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawAt = (
  context: DrawContext,
  text: string,
  options: {
    x?: number;
    width?: number;
    font?: PDFFont;
    size?: number;
    lineHeight?: number;
    gapAfter?: number;
    color?: RGB;
  } = {},
) => {
  if (context.truncated) return;
  const x = options.x ?? PAGE.margin;
  const width = options.width ?? PAGE.width - x - PAGE.margin;
  const font = options.font ?? context.fonts.body;
  const size = options.size ?? 10;
  const lineHeight = options.lineHeight ?? size * 1.35;
  const lines = wrapLines(text, font, size, width);
  for (const line of lines) {
    if (context.y < CONTENT_FLOOR) {
      context.truncated = true;
      return;
    }
    context.page.drawText(line, {
      x,
      y: context.y,
      size,
      font,
      color: options.color ?? COLORS.ink,
    });
    context.y -= lineHeight;
  }
  context.y -= options.gapAfter ?? 7;
};

const label = (context: DrawContext, text: string) => {
  drawAt(context, sanitize(text).toUpperCase(), {
    font: context.fonts.bodyBold,
    size: 7.5,
    lineHeight: 10,
    gapAfter: 9,
    color: COLORS.bronze,
  });
};

const title = (context: DrawContext, text: string, size = 27) => {
  drawAt(context, text, {
    font: context.fonts.displayBold,
    size,
    lineHeight: size + 4,
    gapAfter: 14,
    color: COLORS.forest,
  });
};

const rule = (context: DrawContext, gap = 14) => {
  if (context.y < CONTENT_FLOOR) {
    context.truncated = true;
    return;
  }
  context.page.drawLine({
    start: { x: PAGE.margin, y: context.y },
    end: { x: PAGE.width - PAGE.margin, y: context.y },
    thickness: 0.7,
    color: COLORS.rule,
  });
  context.y -= gap;
};

const bullet = (
  context: DrawContext,
  heading: string,
  body: string,
  source?: string,
  size = 9,
) => {
  if (context.y < CONTENT_FLOOR) {
    context.truncated = true;
    return;
  }
  context.page.drawCircle({
    x: PAGE.margin + 3,
    y: context.y + 3,
    size: 2.5,
    color: COLORS.bronze,
  });
  drawAt(context, heading, {
    x: PAGE.margin + 15,
    width: PAGE.width - PAGE.margin * 2 - 15,
    font: context.fonts.bodyBold,
    size: size + 1,
    lineHeight: size + 3,
    gapAfter: 3,
  });
  drawAt(context, body, {
    x: PAGE.margin + 15,
    width: PAGE.width - PAGE.margin * 2 - 15,
    size,
    lineHeight: size + 3,
    gapAfter: source ? 2 : 9,
    color: COLORS.muted,
  });
  if (source) {
    drawAt(context, `SOURCE: ${source.toUpperCase()}`, {
      x: PAGE.margin + 15,
      width: PAGE.width - PAGE.margin * 2 - 15,
      font: context.fonts.bodyBold,
      size: 7,
      lineHeight: 9,
      gapAfter: 9,
      color: COLORS.bronze,
    });
  }
};

const addPage = (
  pdf: PDFDocument,
  fonts: Fonts,
  pageNumber: number,
  section: string,
) => {
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: COLORS.paper,
  });
  page.drawText("BUSINESS INDEPENDENCE ASSESSMENT", {
    x: PAGE.margin,
    y: PAGE.height - 35,
    size: 7,
    font: fonts.bodyBold,
    color: COLORS.forest,
  });
  const header = sanitize(section).toUpperCase();
  page.drawText(header, {
    x:
      PAGE.width -
      PAGE.margin -
      fonts.body.widthOfTextAtSize(header, 7),
    y: PAGE.height - 35,
    size: 7,
    font: fonts.body,
    color: COLORS.muted,
  });
  page.drawLine({
    start: { x: PAGE.margin, y: 42 },
    end: { x: PAGE.width - PAGE.margin, y: 42 },
    thickness: 0.6,
    color: COLORS.rule,
  });
  page.drawText(`CONFIDENTIAL | PAGE ${pageNumber} OF 7`, {
    x: PAGE.margin,
    y: 26,
    size: 7,
    font: fonts.body,
    color: COLORS.muted,
  });
  return { page, fonts, y: PAGE.height - 78, truncated: false };
};

export const categoryFor = (score: number | null) =>
  score === null
    ? "Result incomplete"
    : score >= 80
      ? "Strong independence"
      : score >= 65
        ? "Emerging independence"
        : score >= 45
          ? "Developing independence"
          : "High dependency";

const formatDate = (value: string) => {
  const match = sanitize(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "Date not retained";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
};

const evidenceSummary = (finding: Finding) =>
  finding.component
    ? `Normalized ${finding.kind} finding for ${COMPONENTS[finding.component].label}; question-level responses are not retained.`
    : `Normalized ${finding.kind} finding; question-level responses are not retained.`;

const findingLabel = (finding: Finding) =>
  FINDING_LABELS[finding.code] ??
  (finding.component
    ? `${COMPONENTS[finding.component].label} ${finding.kind}`
    : "Controlled finding");

const capacityInputLabel = (source: string) =>
  source === "exact"
    ? "EXACT INPUT"
    : source === "banded"
      ? "BANDED INPUT"
      : "NO CAPACITY INPUT";

type CapacityAvailable = {
  status: "available";
  impactConfidence: "high" | "medium";
  inputSource: "exact" | "banded";
  sourceLabel:
    | "realization-adjusted from exact input"
    | "realization-adjusted from banded input";
  grossHours: { owner: number; reporting: number; rework: number };
  realization: { low: number; high: number };
  recoverableHours: { low: number; high: number };
  annualValue: { low: number; high: number };
  assumptions: string[];
  exclusions: string[];
};

type CapacityUnavailable = {
  status: "unavailable" | "inconsistent";
  impactConfidence: string;
  inputSource: string;
  sourceLabel: "unavailable";
  grossHours: { owner: number; reporting: number; rework: number } | null;
  assumptions: string[];
  exclusions: string[];
  notice: string;
};

export type CapacityPresentation =
  | CapacityAvailable
  | CapacityUnavailable;

const controlledTexts = (
  json: string,
  library: Record<string, string>,
  empty: string,
) => {
  const codes = parseArray<string>(json);
  return codes.length
    ? codes.map(
        (code) => library[code] ?? "Unrecognized controlled code.",
      )
    : [empty];
};

export function deriveCapacityPresentation(
  record: AssessmentReportRecord,
): CapacityPresentation {
  const grossValues = [
    record.ownerGrossHours,
    record.reportingGrossHours,
    record.reworkGrossHours,
  ];
  const grossIsValid = grossValues.every(
    (value) => isFiniteNumber(value) && value >= 0,
  );
  const grossHours = grossIsValid
    ? {
        owner: record.ownerGrossHours,
        reporting: record.reportingGrossHours,
        rework: record.reworkGrossHours,
      }
    : null;
  const assumptions = controlledTexts(
    record.capacityAssumptionCodesJson,
    ASSUMPTIONS,
    "No controlled capacity assumptions were retained.",
  );
  const exclusions = controlledTexts(
    record.capacityExclusionCodesJson,
    EXCLUSIONS,
    "No controlled exclusions were recorded.",
  );
  const rangeValues = [
    record.grossCapacityValue,
    record.realizationFactorLow,
    record.realizationFactorHigh,
    record.recoverableHoursLow,
    record.recoverableHoursHigh,
    record.annualValueLow,
    record.annualValueHigh,
  ];
  const rangesAreNull = rangeValues.every((value) => value === null);

  if (
    record.estimateType === "unavailable" &&
    record.impactConfidence === "low" &&
    ["none", "exact", "banded"].includes(record.capacityInputSource) &&
    rangesAreNull &&
    grossHours
  ) {
    return {
      status: "unavailable",
      impactConfidence: record.impactConfidence,
      inputSource: record.capacityInputSource,
      sourceLabel: "unavailable",
      grossHours,
      assumptions,
      exclusions,
      notice:
        "No supported recoverable-hours or monetary estimate is retained.",
    };
  }

  const expected =
    record.estimateType === "calculated" &&
    record.impactConfidence === "high" &&
    record.capacityInputSource === "exact"
      ? {
          inputSource: "exact" as const,
          impactConfidence: "high" as const,
          sourceLabel:
            "realization-adjusted from exact input" as const,
        }
      : record.estimateType === "directional" &&
          record.impactConfidence === "medium" &&
          record.capacityInputSource === "banded"
        ? {
            inputSource: "banded" as const,
            impactConfidence: "medium" as const,
            sourceLabel:
              "realization-adjusted from banded input" as const,
          }
        : null;
  const rangesAreValid = rangeValues.every(
    (value) => isFiniteNumber(value) && value >= 0,
  );
  const rangesAreOrdered =
    rangesAreValid &&
    record.realizationFactorLow <= record.realizationFactorHigh &&
    record.realizationFactorHigh <= 1 &&
    record.recoverableHoursLow <= record.recoverableHoursHigh &&
    record.annualValueLow <= record.annualValueHigh;
  const expectedFactors =
    expected?.inputSource === "exact"
      ? { low: 0.5, high: 0.7 }
      : expected?.inputSource === "banded"
        ? { low: 0.35, high: 0.55 }
        : null;
  const grossTotal = grossHours
    ? grossHours.owner + grossHours.reporting + grossHours.rework
    : null;
  const hasCanonicalCapacityMath =
    expectedFactors &&
    grossTotal !== null &&
    record.realizationFactorLow === expectedFactors.low &&
    record.realizationFactorHigh === expectedFactors.high &&
    record.recoverableHoursLow ===
      Math.round(grossTotal * expectedFactors.low) &&
    record.recoverableHoursHigh ===
      Math.round(grossTotal * expectedFactors.high) &&
    record.grossCapacityValue !== null &&
    record.annualValueLow ===
      Math.round(record.grossCapacityValue * expectedFactors.low) &&
    record.annualValueHigh ===
      Math.round(record.grossCapacityValue * expectedFactors.high);

  if (expected && grossHours && rangesAreOrdered && hasCanonicalCapacityMath) {
    return {
      status: "available",
      ...expected,
      grossHours,
      realization: {
        low: record.realizationFactorLow,
        high: record.realizationFactorHigh,
      },
      recoverableHours: {
        low: record.recoverableHoursLow,
        high: record.recoverableHoursHigh,
      },
      annualValue: {
        low: record.annualValueLow,
        high: record.annualValueHigh,
      },
      assumptions,
      exclusions,
    };
  }

  return {
    status: "inconsistent",
    impactConfidence: record.impactConfidence,
    inputSource: record.capacityInputSource,
    sourceLabel: "unavailable",
    grossHours: null,
    assumptions,
    exclusions,
    notice:
      "Inconsistent retained estimate: the compact capacity tuple is incomplete or internally incoherent. No recoverable-hours or monetary estimate is rendered.",
  };
}

const sourceKey = (context: DrawContext) => {
  rule(context, 10);
  drawAt(
    context,
    "Estimate source key: exact input = entered values; banded input = selected range midpoint; derived = deterministic scoring; realization-adjusted = modeled range applied to retained capacity inputs.",
    { size: 7.5, lineHeight: 10, gapAfter: 0, color: COLORS.muted },
  );
};

export async function buildAssessmentPdf(
  record: AssessmentReportRecord,
): Promise<Uint8Array> {
  const capacityPresentation = deriveCapacityPresentation(record);
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    body: await pdf.embedFont(StandardFonts.Helvetica),
    bodyBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    display: await pdf.embedFont(StandardFonts.TimesRoman),
    displayBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  pdf.setTitle("Business Independence Assessment - Executive Summary");
  pdf.setSubject("Controlled executive report reconstructed from a compact record");
  pdf.setCreator("Business Independence Assessment");
  pdf.setProducer("pdf-lib");

  const findings = parseArray<Finding>(record.findingsJson)
    .filter(
      (finding) =>
        finding &&
        typeof finding.code === "string" &&
        ["risk", "watchpoint", "strength"].includes(finding.kind),
    )
    .slice(0, 3);
  const priorities = parseArray<string>(record.priorityIdsJson)
    .filter((id): id is ComponentId => id in PRIORITIES)
    .slice(0, 3);
  const route = ROUTES[record.leadRoute] ?? ROUTES.nurture;

  const cover = addPage(pdf, fonts, 1, "Executive report");
  cover.page.drawRectangle({
    x: 0,
    y: 0,
    width: 18,
    height: PAGE.height,
    color: COLORS.forest,
  });
  label(cover, "Private executive summary");
  title(cover, "Business Independence Assessment", 29);
  drawAt(cover, `Respondent: ${record.name ?? "Not retained"}`, {
    font: fonts.display,
    size: 15,
    lineHeight: 19,
    gapAfter: 4,
    color: COLORS.muted,
  });
  drawAt(cover, `Company: ${record.company ?? "Not retained"}`, {
    font: fonts.display,
    size: 15,
    lineHeight: 19,
    gapAfter: 4,
    color: COLORS.muted,
  });
  drawAt(cover, `Assessment date: ${formatDate(record.createdAt)}`, {
    size: 10,
    gapAfter: 20,
    color: COLORS.muted,
  });
  drawAt(
    cover,
    record.overallScore === null
      ? "Result incomplete"
      : `${integer.format(record.overallScore)} / 100`,
    {
      font: fonts.displayBold,
      size: 38,
      lineHeight: 42,
      gapAfter: 2,
      color: COLORS.forest,
    },
  );
  drawAt(cover, `${categoryFor(record.overallScore)} | SOURCE: DERIVED`, {
    font: fonts.bodyBold,
    size: 9,
    gapAfter: 20,
    color: COLORS.bronze,
  });
  rule(cover);
  drawAt(
    cover,
    `Score confidence: ${record.scoreConfidence} | Impact confidence: ${capacityPresentation.impactConfidence}`,
    { font: fonts.bodyBold, size: 10, gapAfter: 8 },
  );
  drawAt(
    cover,
    "Self-reported note: This assessment applies deterministic rules to self-reported information. It is not an audit or independent validation.",
    { size: 9.5, lineHeight: 13, gapAfter: 8, color: COLORS.muted },
  );
  drawAt(
    cover,
    "The report is reconstructed from controlled compact fields. Raw answers and free-text narratives are not retained.",
    { size: 9, lineHeight: 12, color: COLORS.muted },
  );

  const summary = addPage(pdf, fonts, 2, "Executive summary");
  label(summary, "Decision view");
  title(summary, "Executive summary");
  drawAt(
    summary,
    `${categoryFor(record.overallScore)} is indicated with ${record.scoreConfidence} score confidence.`,
    { font: fonts.display, size: 15, lineHeight: 20, gapAfter: 12 },
  );
  label(summary, "Top supported findings");
  if (findings.length) {
    for (const finding of findings) {
      bullet(
        summary,
        findingLabel(finding),
        evidenceSummary(finding),
        "derived from controlled evidence code",
        8,
      );
    }
  } else {
    bullet(
      summary,
      "No supported findings retained",
      "Complete the evidence base before interpreting operating constraints.",
    );
  }
  label(summary, "Capacity signal");
  drawAt(
    summary,
    capacityPresentation.status === "available"
      ? `${integer.format(capacityPresentation.recoverableHours.low)} - ${integer.format(capacityPresentation.recoverableHours.high)} recoverable hours; ${currency.format(capacityPresentation.annualValue.low)} - ${currency.format(capacityPresentation.annualValue.high)} annual capacity value.`
      : capacityPresentation.notice,
    { size: 9, lineHeight: 12, gapAfter: 4 },
  );
  drawAt(summary, `SOURCE: ${capacityPresentation.sourceLabel.toUpperCase()}`, {
    font: fonts.bodyBold,
    size: 7,
    gapAfter: 9,
    color: COLORS.bronze,
  });
  label(summary, "Routed next step");
  drawAt(summary, `${route.label} - ${route.reason} Route: ${route.path}`, {
    size: 9,
    lineHeight: 12,
  });

  const components = addPage(pdf, fonts, 3, "Component scores");
  label(components, "Controlled component view");
  title(components, "Component scores");
  drawAt(
    components,
    `Score confidence: ${record.scoreConfidence} | Coverage: ${integer.format(record.scoreCoverage * 100)} percent | SOURCE: DERIVED`,
    { font: fonts.bodyBold, size: 8.5, gapAfter: 10, color: COLORS.bronze },
  );
  for (const [componentId, definition] of Object.entries(COMPONENTS) as [
    ComponentId,
    ComponentDefinition,
  ][]) {
    const score = record[definition.scoreKey];
    drawAt(
      components,
      `${definition.label}: ${score === null ? "Incomplete" : `${integer.format(score)} / 100`}`,
      { font: fonts.bodyBold, size: 11, gapAfter: 2, color: COLORS.forest },
    );
    const strength = findings.find(
      (candidate) =>
        candidate.component === componentId &&
        candidate.kind === "strength",
    );
    const constraint = findings.find(
      (candidate) =>
        candidate.component === componentId &&
        (candidate.kind === "risk" ||
          candidate.kind === "watchpoint"),
    );
    drawAt(
      components,
      strength
        ? `Controlled strength: ${evidenceSummary(strength)}`
        : "No controlled strength supported by the compact record.",
      {
      size: 7.8,
      lineHeight: 10,
      gapAfter: 2,
      },
    );
    drawAt(
      components,
      constraint
        ? `Controlled constraint: ${evidenceSummary(constraint)}`
        : "No controlled constraint supported by the compact record.",
      {
      size: 7.8,
      lineHeight: 10,
      gapAfter: 2,
      },
    );
    drawAt(
      components,
      `Evidence basis: ${
        strength || constraint
          ? [strength, constraint]
              .filter(
                (finding): finding is Finding =>
                  finding !== undefined,
              )
              .map(evidenceSummary)
              .join(" ")
          : "No matching controlled finding evidence is retained for this component."
      }`,
      { size: 7.8, lineHeight: 10, gapAfter: 8, color: COLORS.muted },
    );
  }
  sourceKey(components);

  const capacity = addPage(pdf, fonts, 4, "Recoverable capacity");
  label(capacity, "Bounded operating estimate");
  title(capacity, "Recoverable capacity");
  drawAt(capacity, `Impact confidence: ${capacityPresentation.impactConfidence}`, {
    font: fonts.bodyBold,
    size: 10,
    gapAfter: 10,
    color: COLORS.bronze,
  });
  if (capacityPresentation.status === "inconsistent") {
    label(capacity, "Inconsistent retained estimate");
    drawAt(
      capacity,
      capacityPresentation.notice,
      { font: fonts.display, size: 14, lineHeight: 18, gapAfter: 10 },
    );
  } else {
    if (capacityPresentation.grossHours) {
      const grossRows = [
        ["Owner gross hours", capacityPresentation.grossHours.owner],
        [
          "Reporting gross hours",
          capacityPresentation.grossHours.reporting,
        ],
        ["Rework gross hours", capacityPresentation.grossHours.rework],
      ] as const;
      for (const [heading, value] of grossRows) {
        drawAt(
          capacity,
          `${heading}: ${integer.format(value)} | SOURCE: ${capacityInputLabel(capacityPresentation.inputSource)}`,
          { font: fonts.bodyBold, size: 9, gapAfter: 5 },
        );
      }
    }
  }
  if (capacityPresentation.status === "unavailable") {
    label(capacity, "Nonfinancial supported indicators");
    drawAt(
      capacity,
      "The retained category hours above are visible without assigning a recoverable-hours or monetary value.",
      { size: 9, lineHeight: 12, gapAfter: 8 },
    );
    label(capacity, "Inputs needed");
    drawAt(
      capacity,
      "Complete time, frequency, people, and cost inputs across at least two eligible categories are needed for a supported range.",
      { size: 9, lineHeight: 12, gapAfter: 8 },
    );
  } else if (capacityPresentation.status === "available") {
    drawAt(
      capacity,
      `Recoverable hours: ${integer.format(capacityPresentation.recoverableHours.low)} - ${integer.format(capacityPresentation.recoverableHours.high)}`,
      { font: fonts.displayBold, size: 19, lineHeight: 23, gapAfter: 3, color: COLORS.forest },
    );
    drawAt(
      capacity,
      `Annual capacity value: ${currency.format(capacityPresentation.annualValue.low)} - ${currency.format(capacityPresentation.annualValue.high)}`,
      { font: fonts.displayBold, size: 17, lineHeight: 21, gapAfter: 5, color: COLORS.forest },
    );
    drawAt(
      capacity,
      `Realization range: ${integer.format(capacityPresentation.realization.low * 100)} - ${integer.format(capacityPresentation.realization.high * 100)} percent`,
      { font: fonts.bodyBold, size: 9, gapAfter: 2 },
    );
    drawAt(capacity, `SOURCE: ${capacityPresentation.sourceLabel.toUpperCase()}`, {
      font: fonts.bodyBold,
      size: 7,
      gapAfter: 8,
      color: COLORS.bronze,
    });
  }
  label(capacity, "Assumptions");
  drawAt(
    capacity,
    capacityPresentation.assumptions.join(" "),
    { size: 7.8, lineHeight: 10, gapAfter: 7, color: COLORS.muted },
  );
  label(capacity, "Exclusions");
  drawAt(
    capacity,
    capacityPresentation.exclusions.join(" "),
    { size: 7.8, lineHeight: 10, color: COLORS.muted },
  );

  const supported = addPage(pdf, fonts, 5, "Risk profile");
  label(supported, "Controlled evidence and implications");
  title(supported, "Risk profile");
  const risks = findings.filter((finding) => finding.kind === "risk");
  const watchpoints = findings.filter(
    (finding) => finding.kind === "watchpoint",
  );
  label(supported, "Supported deterministic risks");
  if (risks.length) {
    for (const finding of risks) {
      const definition = finding.component
        ? COMPONENTS[finding.component]
        : null;
      bullet(
        supported,
        findingLabel(finding),
        `Evidence summary: ${evidenceSummary(finding)} Implication: ${
          definition?.implication ??
          "Missing evidence reduces the confidence available for operating interpretation."
        } Causes require validation: the aggregate result does not establish root cause.`,
        "derived from controlled evidence code",
        8,
      );
    }
  } else {
    drawAt(
      supported,
      "No deterministic risk finding is supported by the compact record.",
      { size: 9, lineHeight: 12, gapAfter: 9 },
    );
  }
  if (watchpoints.length) {
    label(supported, "Watchpoints (not risks)");
    for (const finding of watchpoints) {
      const definition = finding.component
        ? COMPONENTS[finding.component]
        : null;
      bullet(
        supported,
        findingLabel(finding),
        `Evidence summary: ${evidenceSummary(finding)} Implication: ${
          definition?.implication ??
          "The finding requires controlled follow-up."
        } Causes require validation: the aggregate result does not establish root cause.`,
        "derived watchpoint from controlled evidence code",
        8,
      );
    }
  }
  sourceKey(supported);

  const direction = addPage(pdf, fonts, 6, "90-day direction");
  label(direction, "Controlled action sequence");
  title(direction, "90-day priority direction");
  const ordered = priorities.length
    ? priorities
    : (Object.keys(PRIORITIES) as ComponentId[]);
  ordered.slice(0, 3).forEach((componentId, index) => {
    const priority = PRIORITIES[componentId];
    bullet(
      direction,
      `${index + 1}. ${priority.title}`,
      `${priority.action} Leading indicator: ${priority.indicator}.`,
      "derived priority order",
      9,
    );
  });
  label(direction, "Paid diagnostic boundary");
  drawAt(
    direction,
    "The 90-day direction is educational and does not include root-cause validation, implementation design, quantified business-case validation, or execution support. Those activities require a separately agreed paid diagnostic or advisory engagement.",
    { size: 9, lineHeight: 12, color: COLORS.muted },
  );

  const methodology = addPage(pdf, fonts, 7, "Methodology and confidence");
  label(methodology, "Boundary, sources, and routing");
  title(methodology, "Methodology and confidence");
  bullet(
    methodology,
    `Methodology ${record.assessmentVersion}`,
    `Deterministic scoring, controlled evidence reconstruction, and routing use compact retained fields. Score confidence: ${record.scoreConfidence}. Impact confidence: ${capacityPresentation.impactConfidence}. Capacity presentation: ${capacityPresentation.status}. Coverage: ${integer.format(record.scoreCoverage * 100)} percent.`,
    "derived",
    8,
  );
  label(methodology, "Estimate source key");
  drawAt(
    methodology,
    "Exact input = entered values. Banded input = selected self-reported range midpoint. Derived = deterministic scoring or routing. Realization-adjusted = modeled range applied to retained capacity inputs.",
    { size: 8, lineHeight: 11, gapAfter: 7 },
  );
  label(methodology, "Limitations");
  drawAt(
    methodology,
    "Raw answers, question-level evidence, and free-text narratives are not retained. Findings are reconstructed from normalized derived codes and remain directional; causes require validation.",
    { size: 8, lineHeight: 11, gapAfter: 7, color: COLORS.muted },
  );
  label(methodology, "Professional boundary");
  drawAt(
    methodology,
    "This assessment is not an audit and does not validate root causes, implementation effort, savings, revenue, valuation, legal compliance, tax treatment, or financial outcomes.",
    { size: 8, lineHeight: 11, gapAfter: 7, color: COLORS.muted },
  );
  label(methodology, "Routed next step");
  drawAt(
    methodology,
    `${route.label}. ${route.reason} Route: ${route.path}`,
    { font: fonts.bodyBold, size: 9, lineHeight: 12, gapAfter: 7, color: COLORS.forest },
  );
  label(methodology, "Eddie contact");
  drawAt(
    methodology,
    "Edward (Eddie) Abiodun | Business Independence Advisory | /contact",
    { font: fonts.bodyBold, size: 9, gapAfter: 0 },
  );

  return pdf.save({ useObjectStreams: false });
}
