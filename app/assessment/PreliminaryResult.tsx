import type { AssessmentResult } from "../../lib/assessment/result";
import type { AssessmentAnswers, CapacityCategory } from "../../lib/assessment/types";

type PreliminaryResultProps = {
  answers: AssessmentAnswers;
  result: AssessmentResult;
  onUnlock: () => void;
  onReview: () => void;
};

const CATEGORY_LABELS = {
  strong: "Strong independence",
  emerging: "Emerging independence",
  developing: "Developing independence",
  highDependency: "High dependency",
  incomplete: "Result incomplete",
} as const;

const CAPACITY_LABELS: Record<CapacityCategory, string> = {
  owner: "owner intervention",
  reporting: "reporting and reconciliation",
  rework: "rework",
};

const directTimeInsight = (answers: AssessmentAnswers): string | null => {
  const activity = answers.capacity.activities.find(
    (candidate) =>
      Number.isFinite(candidate.hoursPerOccurrence) &&
      Number.isFinite(candidate.occurrencesPerYear) &&
      (candidate.category === "owner" || Number.isFinite(candidate.people)),
  );
  if (!activity) return null;

  const people = activity.category === "owner" ? 1 : activity.people;
  const annualHours = Math.round(
    activity.hoursPerOccurrence * activity.occurrencesPerYear * people,
  );
  return `${annualHours.toLocaleString("en-US")} reported ${CAPACITY_LABELS[activity.category]} hours per year`;
};

export function PreliminaryResult({
  answers,
  result,
  onUnlock,
  onReview,
}: PreliminaryResultProps) {
  const insight = directTimeInsight(answers);

  return (
    <>
      <div className="assessment-kicker">Preliminary result</div>
      <h1>
        {result.score.overall === null
          ? "Result incomplete"
          : `${result.score.overall} out of 100`}
      </h1>
      <div className="assessment-result-meta" aria-label="Preliminary score summary">
        <span>{CATEGORY_LABELS[result.score.category]}</span>
        <span>Score confidence: {result.score.confidence.level}</span>
      </div>

      <section className="assessment-result-section" aria-labelledby="preliminary-risks">
        <h2 id="preliminary-risks">Most exposed operating patterns</h2>
        <ul className="assessment-risk-list" aria-label="Preliminary risks">
          {result.risks.slice(0, 2).map((risk) => (
            <li key={risk.code}>{risk.label}</li>
          ))}
        </ul>
      </section>

      {insight && (
        <p className="assessment-time-insight">
          <strong>Reported time:</strong> {insight}.
        </p>
      )}

      <section className="assessment-result-section" aria-labelledby="locked-result">
        <h2 id="locked-result">Included in your full assessment</h2>
        <ul className="assessment-lock-grid">
          {[
            "Component scores",
            "Recoverable capacity",
            "Priority direction",
            "Executive-summary PDF",
          ].map((preview) => (
            <li key={preview}>
              <span aria-hidden="true">Locked</span>
              {preview}
            </li>
          ))}
        </ul>
      </section>

      <div className="assessment-actions assessment-actions-split">
        <button className="assessment-back" type="button" onClick={onReview}>
          Review my answers
        </button>
        <button className="button" type="button" onClick={onUnlock}>
          Unlock my full assessment
        </button>
      </div>
    </>
  );
}
