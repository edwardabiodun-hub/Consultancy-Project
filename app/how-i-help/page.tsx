import { DiagnosticCta, PageHero } from "../../components/SiteParts";

export const metadata = {
  title: "Business Outcomes",
  description: "Reduce owner dependency, improve executive decisions, and automate recurring operational work.",
};

const outcomes = [
  {
    id: "dependency",
    title: "Reduce owner dependency",
    problem: "Decisions, relationships, knowledge, and exceptions continue to return to the owner.",
    work: "Map dependency, clarify decision rights, document critical operating knowledge, and establish escalation rules.",
    outcome: "Managers can act with clearer authority while the owner focuses on decisions that genuinely require judgment.",
  },
  {
    id: "decisions",
    title: "Improve executive decisions",
    problem: "Leaders spend time assembling and reconciling the operating picture before they can decide.",
    work: "Design KPI architecture, executive reporting, forecasting visibility, and a decision-focused management cadence.",
    outcome: "A concise view of performance, risk, ownership, and next actions that leadership can use consistently.",
  },
  {
    id: "automation",
    title: "Automate manual operations",
    problem: "Recurring reporting, handoffs, and administrative work consume leadership capacity.",
    work: "Simplify the workflow first, then apply reporting automation, workflow automation, or AI where the business case is defensible.",
    outcome: "Less recurring friction without replacing useful systems or automating an unclear process.",
  },
];

export default function HowIHelp() {
  return (
    <>
      <PageHero eyebrow="Business outcomes" title="Solve the operating problem before selecting the technology.">
        The work is organized around the change leaders need: less owner dependency, clearer executive
        decisions, and fewer manual operations.
      </PageHero>
      <div className="content shell">
        {outcomes.map((outcome) => (
          <section className="category" id={outcome.id} key={outcome.id}>
            <div className="eyebrow">Business outcome</div>
            <h2>{outcome.title}</h2>
            <div className="process-grid">
              <div className="process-step"><h3>The leadership problem</h3><p>{outcome.problem}</p></div>
              <div className="process-step"><h3>The intervention</h3><p>{outcome.work}</p></div>
              <div className="process-step"><h3>The operating result</h3><p>{outcome.outcome}</p></div>
            </div>
          </section>
        ))}
        <div className="callout">
          <div className="eyebrow">Role of AI</div>
          <h2>AI is an enabling mechanism—not the positioning.</h2>
          <p>
            It is introduced only after the decision, owner, workflow, and expected operating improvement
            are clear.
          </p>
        </div>
      </div>
      <DiagnosticCta />
    </>
  );
}
