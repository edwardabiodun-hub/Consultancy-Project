import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

export type AssessmentReportRecord = {
  id: string;
  assessmentVersion: string;
  createdAt?: string;
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
  recoverableHoursLow: number | null;
  recoverableHoursHigh: number | null;
  annualValueLow: number | null;
  annualValueHigh: number | null;
  riskCodesJson: string;
  priorityIdsJson: string;
  leadRoute: string;
  narrativeSource: string;
};

const PAGE = { width: 612, height: 792, margin: 54 };
const COLORS = {
  paper: rgb(0.984, 0.980, 0.965),
  ink: rgb(0.094, 0.137, 0.118),
  forest: rgb(0.090, 0.247, 0.196),
  bronze: rgb(0.604, 0.412, 0.227),
  muted: rgb(0.35, 0.39, 0.36),
  rule: rgb(0.79, 0.77, 0.72),
  white: rgb(1, 1, 1),
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
};

type PriorityDefinition = {
  title: string;
  action: string;
  indicator: string;
};

const COMPONENTS = [
  ["Owner independence", "ownerIndependenceScore"],
  ["Operating-system maturity", "operatingSystemScore"],
  ["Information visibility", "informationVisibilityScore"],
] as const;

const PRIORITIES: Record<string, PriorityDefinition> = {
  ownerIndependence: {
    title: "Clarify decision authority",
    action:
      "Define recurring decisions managers can make and the conditions requiring escalation.",
    indicator: "Routine decisions resolved without owner intervention",
  },
  operatingSystem: {
    title: "Stabilize one critical workflow",
    action:
      "Assign an accountable owner and document decision points, handoffs, and exceptions.",
    indicator: "Exceptions resolved through the documented workflow",
  },
  informationVisibility: {
    title: "Create a decision-ready KPI cadence",
    action:
      "Standardize measures, definitions, owners, and review actions used for decisions.",
    indicator: "Management reviews completed with agreed data and owned actions",
  },
};

const RISKS: Record<string, { title: string; description: string }> = {
  measurement_gap: {
    title: "Measurement gap",
    description:
      "Missing or unknown responses reduced the confidence supported by the retained score record.",
  },
  owner_bottleneck: {
    title: "Owner decision concentration",
    description:
      "The retained result flags owner dependence as a material operating constraint.",
  },
  operating_system_gap: {
    title: "Operating-system inconsistency",
    description:
      "The retained result flags inconsistency in recurring workflows, ownership, or escalation.",
  },
  information_bottleneck: {
    title: "Information visibility gap",
    description:
      "The retained result flags delayed, incomplete, or insufficiently decision-ready information.",
  },
};

const ROUTES: Record<string, { label: string; path: string; reason: string }> = {
  diagnostic: {
    label: "Discuss the Business Independence Diagnostic",
    path: "/diagnostic",
    reason:
      "The retained dependency profile supports a focused diagnostic conversation.",
  },
  nurture: {
    label: "Get the 90-Day Business Independence Checklist",
    path: "/founder-resources",
    reason:
      "Build operating discipline before deciding whether a diagnostic is warranted.",
  },
  insights: {
    label: "Explore executive operating insights",
    path: "/founder-resources",
    reason:
      "Use focused operating insights to protect and extend current independence.",
  },
  restricted: {
    label: "Explore educational founder resources",
    path: "/founder-resources",
    reason:
      "The recorded professional boundary limits the report to an educational next step.",
  },
};

const sanitize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseStringArray = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const categoryFor = (score: number | null) =>
  score === null
    ? "Result incomplete"
    : score >= 80
      ? "Strong independence"
      : score >= 65
        ? "Emerging independence"
        : score >= 45
          ? "Developing independence"
          : "High dependency";

const wrapLines = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) => {
  const paragraphs = sanitize(text).split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ").filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
};

const drawWrapped = (
  context: DrawContext,
  text: string,
  options: {
    font?: PDFFont;
    size?: number;
    color?: RGB;
    width?: number;
    lineHeight?: number;
    gapAfter?: number;
  } = {},
) => {
  const font = options.font ?? context.fonts.body;
  const size = options.size ?? 11;
  const width = options.width ?? PAGE.width - PAGE.margin * 2;
  const lineHeight = options.lineHeight ?? size * 1.45;
  for (const line of wrapLines(text, font, size, width)) {
    context.page.drawText(line, {
      x: PAGE.margin,
      y: context.y,
      size,
      font,
      color: options.color ?? COLORS.ink,
    });
    context.y -= lineHeight;
  }
  context.y -= options.gapAfter ?? 8;
};

const drawSectionLabel = (context: DrawContext, text: string) => {
  context.page.drawText(sanitize(text).toUpperCase(), {
    x: PAGE.margin,
    y: context.y,
    size: 8,
    font: context.fonts.bodyBold,
    color: COLORS.bronze,
    characterSpacing: 1.2,
  });
  context.y -= 22;
};

const drawTitle = (context: DrawContext, text: string) => {
  drawWrapped(context, text, {
    font: context.fonts.displayBold,
    size: 28,
    color: COLORS.forest,
    lineHeight: 32,
    gapAfter: 18,
  });
};

const drawRule = (context: DrawContext, gap = 18) => {
  context.page.drawLine({
    start: { x: PAGE.margin, y: context.y },
    end: { x: PAGE.width - PAGE.margin, y: context.y },
    thickness: 0.7,
    color: COLORS.rule,
  });
  context.y -= gap;
};

const drawBullet = (
  context: DrawContext,
  title: string,
  body: string,
  source?: string,
) => {
  context.page.drawCircle({
    x: PAGE.margin + 4,
    y: context.y + 4,
    size: 3,
    color: COLORS.bronze,
  });
  const textX = PAGE.margin + 18;
  context.page.drawText(sanitize(title), {
    x: textX,
    y: context.y,
    size: 12,
    font: context.fonts.bodyBold,
    color: COLORS.ink,
  });
  context.y -= 18;
  for (const line of wrapLines(
    body,
    context.fonts.body,
    10,
    PAGE.width - textX - PAGE.margin,
  )) {
    context.page.drawText(line, {
      x: textX,
      y: context.y,
      size: 10,
      font: context.fonts.body,
      color: COLORS.muted,
    });
    context.y -= 14;
  }
  if (source) {
    context.page.drawText(`SOURCE: ${sanitize(source).toUpperCase()}`, {
      x: textX,
      y: context.y - 1,
      size: 7.5,
      font: context.fonts.bodyBold,
      color: COLORS.bronze,
      characterSpacing: 0.7,
    });
    context.y -= 16;
  }
  context.y -= 12;
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
    size: 7.5,
    font: fonts.bodyBold,
    color: COLORS.forest,
    characterSpacing: 1,
  });
  page.drawText(sanitize(section).toUpperCase(), {
    x: PAGE.width - PAGE.margin - fonts.body.widthOfTextAtSize(section.toUpperCase(), 7.5),
    y: PAGE.height - 35,
    size: 7.5,
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
    characterSpacing: 0.5,
  });
  return { page, fonts, y: PAGE.height - 88 };
};

const drawSourceKey = (context: DrawContext) => {
  drawRule(context, 16);
  drawWrapped(
    context,
    "Estimate source key: exact input = entered values; banded input = selected range midpoint; derived = deterministic scoring; realization-adjusted = modeled range applied to retained capacity inputs.",
    { size: 8.5, color: COLORS.muted, lineHeight: 12, gapAfter: 0 },
  );
};

const capacitySource = (record: AssessmentReportRecord) =>
  record.estimateType === "calculated"
    ? "realization-adjusted from exact input"
    : record.estimateType === "directional"
      ? "realization-adjusted from banded input"
      : "unavailable";

export async function buildAssessmentPdf(
  record: AssessmentReportRecord,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    body: await pdf.embedFont(StandardFonts.Helvetica),
    bodyBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    display: await pdf.embedFont(StandardFonts.TimesRoman),
    displayBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  pdf.setTitle("Business Independence Assessment - Executive Summary");
  pdf.setSubject("Rules-based executive assessment reconstructed from a compact record");
  pdf.setCreator("Business Independence Assessment");
  pdf.setProducer("pdf-lib");

  const cover = addPage(pdf, fonts, 1, "Executive report");
  cover.page.drawRectangle({
    x: 0,
    y: 0,
    width: 18,
    height: PAGE.height,
    color: COLORS.forest,
  });
  drawSectionLabel(cover, "Private executive summary");
  drawTitle(cover, "Business Independence Assessment");
  drawWrapped(
    cover,
    record.company
      ? `Prepared for ${sanitize(record.company)}`
      : "Prepared from the retained assessment record",
    {
      font: fonts.display,
      size: 16,
      color: COLORS.muted,
      lineHeight: 21,
      gapAfter: 28,
    },
  );
  if (record.overallScore === null) {
    drawWrapped(cover, "Result incomplete", {
      font: fonts.displayBold,
      size: 32,
      color: COLORS.forest,
      lineHeight: 36,
      gapAfter: 4,
    });
  } else {
    drawWrapped(cover, `${number.format(record.overallScore)} / 100`, {
      font: fonts.displayBold,
      size: 40,
      color: COLORS.forest,
      lineHeight: 44,
      gapAfter: 4,
    });
  }
  drawWrapped(cover, `${categoryFor(record.overallScore)} | derived`, {
    font: fonts.bodyBold,
    size: 10,
    color: COLORS.bronze,
    lineHeight: 14,
    gapAfter: 26,
  });
  drawRule(cover, 20);
  drawWrapped(
    cover,
    `Score confidence: ${sanitize(record.scoreConfidence)} | Impact confidence: ${sanitize(record.impactConfidence)}`,
    { font: fonts.bodyBold, size: 11, gapAfter: 12 },
  );
  drawWrapped(
    cover,
    `Assessment ID: ${sanitize(record.id)} | Methodology ${sanitize(record.assessmentVersion)}`,
    { size: 9, color: COLORS.muted, gapAfter: 22 },
  );
  drawWrapped(
    cover,
    "This report is reconstructed only from the compact retained assessment record. Raw answers, detailed evidence, and the original narrative are not stored and are not reproduced.",
    { size: 10, color: COLORS.muted, lineHeight: 14 },
  );

  const summary = addPage(pdf, fonts, 2, "Executive summary");
  drawSectionLabel(summary, "What the retained record supports");
  drawTitle(summary, "Executive summary");
  const weakest = COMPONENTS
    .map(([label, key]) => ({ label, score: record[key] }))
    .filter((item): item is { label: string; score: number } =>
      isFiniteNumber(item.score),
    )
    .sort((left, right) => left.score - right.score)[0];
  drawWrapped(
    summary,
    record.overallScore === null
      ? "The retained record does not support a complete overall score. Use the component evidence and confidence limits before setting priorities."
      : `The deterministic score indicates ${categoryFor(record.overallScore).toLowerCase()}. ${
          weakest
            ? `${weakest.label} is the lowest retained component and the first logical focus.`
            : "Component detail is incomplete."
        }`,
    { font: fonts.display, size: 17, lineHeight: 23, gapAfter: 24 },
  );
  drawBullet(
    summary,
    "Overall independence",
    record.overallScore === null
      ? "No supported overall score is retained."
      : `${number.format(record.overallScore)} out of 100 with ${sanitize(record.scoreConfidence)} confidence.`,
    "derived",
  );
  drawBullet(
    summary,
    "Evidence coverage",
    isFiniteNumber(record.scoreCoverage)
      ? `${number.format(record.scoreCoverage * 100)} percent of weighted score evidence was retained as covered.`
      : "Coverage was not available.",
    "derived",
  );
  drawBullet(
    summary,
    "Capacity signal",
    record.estimateType === "unavailable"
      ? "The retained record does not support a recoverable-hours or financial range."
      : `${number.format(record.recoverableHoursLow ?? 0)} to ${number.format(record.recoverableHoursHigh ?? 0)} recoverable hours are recorded, with ${sanitize(record.impactConfidence)} impact confidence.`,
    capacitySource(record),
  );
  drawSourceKey(summary);

  const components = addPage(pdf, fonts, 3, "Component scores");
  drawSectionLabel(components, "Operating independence profile");
  drawTitle(components, "Component scores");
  drawWrapped(
    components,
    "Each component is a deterministic result from the submitted assessment. The compact record retains scores, not the individual answers behind them.",
    { size: 10.5, color: COLORS.muted, lineHeight: 15, gapAfter: 20 },
  );
  for (const [label, key] of COMPONENTS) {
    const score = record[key];
    components.page.drawText(label, {
      x: PAGE.margin,
      y: components.y,
      size: 12,
      font: fonts.bodyBold,
      color: COLORS.ink,
    });
    const scoreLabel = score === null ? "Incomplete" : `${number.format(score)} / 100`;
    components.page.drawText(scoreLabel, {
      x: PAGE.width - PAGE.margin - fonts.bodyBold.widthOfTextAtSize(scoreLabel, 12),
      y: components.y,
      size: 12,
      font: fonts.bodyBold,
      color: COLORS.forest,
    });
    components.y -= 18;
    components.page.drawRectangle({
      x: PAGE.margin,
      y: components.y,
      width: PAGE.width - PAGE.margin * 2,
      height: 9,
      color: rgb(0.88, 0.87, 0.83),
    });
    if (score !== null) {
      components.page.drawRectangle({
        x: PAGE.margin,
        y: components.y,
        width: (PAGE.width - PAGE.margin * 2) * Math.max(0, Math.min(100, score)) / 100,
        height: 9,
        color: COLORS.forest,
      });
    }
    components.y -= 28;
    drawWrapped(
      components,
      `${categoryFor(score)} | Source: derived`,
      { size: 9, color: COLORS.muted, lineHeight: 12, gapAfter: 20 },
    );
  }
  drawSourceKey(components);

  const capacity = addPage(pdf, fonts, 4, "Recoverable capacity");
  drawSectionLabel(capacity, "Bounded operating estimate");
  drawTitle(capacity, "Recoverable capacity");
  if (
    record.estimateType === "unavailable" ||
    !isFiniteNumber(record.recoverableHoursLow) ||
    !isFiniteNumber(record.recoverableHoursHigh) ||
    !isFiniteNumber(record.annualValueLow) ||
    !isFiniteNumber(record.annualValueHigh)
  ) {
    drawWrapped(
      capacity,
      "No financial estimate is available from the compact retained record.",
      { font: fonts.display, size: 19, lineHeight: 25, gapAfter: 22 },
    );
    drawBullet(
      capacity,
      "What is missing",
      "A supported range requires complete time, frequency, people, and cost inputs across eligible operating categories.",
    );
    drawBullet(
      capacity,
      "What not to infer",
      "No benchmark, market value, savings claim, or placeholder financial estimate has been inserted.",
    );
    drawBullet(
      capacity,
      "Recommended evidence",
      "Capture exact inputs or complete self-reported bands, then rerun the deterministic calculation.",
    );
  } else {
    drawWrapped(
      capacity,
      `${number.format(record.recoverableHoursLow)} - ${number.format(record.recoverableHoursHigh)} hours`,
      { font: fonts.displayBold, size: 29, color: COLORS.forest, lineHeight: 34, gapAfter: 2 },
    );
    drawWrapped(capacity, "Estimated recoverable capacity per year", {
      font: fonts.bodyBold,
      size: 10,
      color: COLORS.muted,
      gapAfter: 22,
    });
    drawWrapped(
      capacity,
      `${currency.format(record.annualValueLow)} - ${currency.format(record.annualValueHigh)}`,
      { font: fonts.displayBold, size: 29, color: COLORS.forest, lineHeight: 34, gapAfter: 2 },
    );
    drawWrapped(capacity, "Estimated annual capacity value", {
      font: fonts.bodyBold,
      size: 10,
      color: COLORS.muted,
      gapAfter: 26,
    });
    drawBullet(
      capacity,
      "Estimate source",
      record.estimateType === "calculated"
        ? "Retained exact-input calculation with a modeled realization range."
        : "Retained banded-input midpoint calculation with a modeled realization range.",
      capacitySource(record),
    );
    drawBullet(
      capacity,
      "Interpretation",
      "The range represents potential operating capacity, not guaranteed savings, cash release, or revenue.",
    );
  }
  drawSourceKey(capacity);

  const risk = addPage(pdf, fonts, 5, "Risk profile");
  drawSectionLabel(risk, "Retained operating signals");
  drawTitle(risk, "Risk profile");
  drawWrapped(
    risk,
    "Risk codes are retained outputs of the rules engine. Because raw answers are not stored, this report does not recreate question-level evidence.",
    { size: 10.5, color: COLORS.muted, lineHeight: 15, gapAfter: 20 },
  );
  const riskCodes = parseStringArray(record.riskCodesJson).slice(0, 3);
  if (riskCodes.length) {
    for (const code of riskCodes) {
      const definition = RISKS[code] ?? {
        title: sanitize(code).replaceAll("_", " "),
        description:
          "This retained rules-engine code requires validation against current operating evidence.",
      };
      drawBullet(risk, definition.title, definition.description, "derived");
    }
  } else {
    drawBullet(
      risk,
      "No retained risk codes",
      "The compact record contains no supported risk codes. This is not evidence that operating risk is absent.",
    );
  }
  drawSourceKey(risk);

  const priorities = addPage(pdf, fonts, 6, "90-day direction");
  drawSectionLabel(priorities, "Controlled action sequence");
  drawTitle(priorities, "90-day priority direction");
  drawWrapped(
    priorities,
    "Treat these as validation-led directions. Confirm ownership, baseline measures, and operating evidence before committing resources.",
    { size: 10.5, color: COLORS.muted, lineHeight: 15, gapAfter: 16 },
  );
  const priorityIds = parseStringArray(record.priorityIdsJson)
    .filter((id) => id in PRIORITIES)
    .slice(0, 3);
  if (priorityIds.length) {
    priorityIds.forEach((id, index) => {
      const priority = PRIORITIES[id];
      drawBullet(
        priorities,
        `${index + 1}. ${priority.title}`,
        `${priority.action} Leading indicator: ${priority.indicator}.`,
        "derived",
      );
    });
  } else {
    drawBullet(
      priorities,
      "Complete the evidence base",
      "Validate missing component evidence before selecting an operating priority.",
    );
  }
  drawSourceKey(priorities);

  const methodology = addPage(pdf, fonts, 7, "Methodology and next step");
  drawSectionLabel(methodology, "Boundary and routing");
  drawTitle(methodology, "Methodology, limitations, and next step");
  drawBullet(
    methodology,
    `Methodology ${sanitize(record.assessmentVersion)}`,
    `Deterministic scoring and routing are reconstructed from the compact record. Narrative source: ${sanitize(record.narrativeSource)}.`,
    "derived",
  );
  drawBullet(
    methodology,
    "Record boundary",
    "The record excludes raw answers, question-level evidence, full narrative, detailed capacity activities, and contact consent history beyond retained status fields.",
  );
  drawBullet(
    methodology,
    "Professional boundary",
    "This assessment is not an audit and does not validate root causes, implementation effort, savings, revenue, valuation, legal compliance, tax treatment, or financial outcomes.",
  );
  const route = ROUTES[record.leadRoute] ?? ROUTES.nurture;
  drawRule(methodology, 20);
  drawSectionLabel(methodology, "Recommended next step");
  drawWrapped(methodology, route.label, {
    font: fonts.displayBold,
    size: 18,
    color: COLORS.forest,
    lineHeight: 23,
    gapAfter: 8,
  });
  drawWrapped(methodology, route.reason, {
    size: 10.5,
    color: COLORS.muted,
    lineHeight: 15,
    gapAfter: 8,
  });
  drawWrapped(methodology, `Route: ${route.path}`, {
    font: fonts.bodyBold,
    size: 10,
    color: COLORS.bronze,
    gapAfter: 0,
  });

  return pdf.save({ useObjectStreams: false });
}
