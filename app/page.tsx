import Link from "next/link";
import { DiagnosticCta } from "../components/SiteParts";
import { resources } from "../content/resources";

const journey = [
  {
    stage: "Diagnose",
    name: "Business Independence Diagnostic",
    question: "Where does the business still depend on me, and what is the operational impact?",
    status: "Defined two-week assessment",
  },
  {
    stage: "Build",
    name: "Executive Operating System",
    question: "What management system will remove the highest-value dependencies?",
    status: "Available when findings justify implementation",
  },
  {
    stage: "Sustain",
    name: "Executive Operations & AI Advisory",
    question: "How do we sustain progress and apply automation responsibly?",
    status: "Available when ongoing advisory support is warranted",
  },
];

export default function Home() {
  return (
    <>
      <section className="shell hero">
        <div>
          <div className="eyebrow">Business Independence & Decision Systems</div>
          <h1>Build a business that can grow without routing every important decision through the owner.</h1>
          <p className="lede">
            Improve executive visibility, clarify how work and decisions move, and remove recurring
            operational friction with practical systems and automation.
          </p>
          <div className="actions">
            <Link className="button" href="/diagnostic">Review the Diagnostic →</Link>
            <Link className="button secondary" href="/contact">Discuss your business dependency</Link>
          </div>
        </div>
        <aside className="decision-margin" aria-label="Decision Margin">
          <div className="vertical">Decision Margin</div>
          <h3>What changes</h3>
          <p>Decisions move with the business instead of automatically returning to the founder.</p>
          <h3>What remains</h3>
          <p>Your judgment, focused where it creates the most value.</p>
        </aside>
      </section>

      <section className="recognition">
        <div className="shell recognition-grid">
          <div><div className="eyebrow">Recognize the pattern</div><h2>When the founder is still the operating system.</h2></div>
          <div><h3>Visibility</h3><p>You assemble the real picture because reports arrive late or conflict.</p></div>
          <div><h3>Decisions</h3><p>Managers wait because authority and escalation rules remain unclear.</p></div>
          <div><h3>Friction</h3><p>Routine approvals, relationships, and recurring work return to you.</p></div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-head">
          <div><div className="eyebrow">Three business outcomes</div><h2>Make independence practical.</h2></div>
          <p>Start with the operating constraint, not a dashboard, automation, or AI tool.</p>
        </div>
        <div className="lever-grid">
          <div className="lever"><h3>Reduce owner dependency</h3><p>Expose the decisions, knowledge, relationships, and work that still require owner intervention.</p></div>
          <div className="lever"><h3>Improve executive decisions</h3><p>Create a decision-ready view of performance, risk, accountability, and next actions.</p></div>
          <div className="lever"><h3>Automate manual operations</h3><p>Remove recurring reporting and workflow friction after the underlying process is clear.</p></div>
        </div>
      </section>

      <section className="journey section">
        <div className="shell">
          <div className="section-head">
            <div><div className="eyebrow">How engagements evolve</div><h2>A clear starting point with room to continue.</h2></div>
            <p>Build and Sustain are continuation paths, not automatic next purchases. They are available only when the Diagnostic findings justify further work.</p>
          </div>
          <div className="journey-grid">
            {journey.map((item, index) => (
              <article className="journey-stage" key={item.stage}>
                <div className="utility">0{index + 1} · {item.stage}</div>
                <h3>{item.name}</h3>
                <p>{item.question}</p>
                <div className="journey-status">{item.status}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <DiagnosticCta />

      <section className="section shell">
        <div className="section-head">
          <div><div className="eyebrow">Insights</div><h2>Start with the pressure point.</h2></div>
          <Link href="/founder-resources">View all insights →</Link>
        </div>
        <div className="resource-grid">
          {resources.slice(0, 3).map((resource) => (
            <Link className="resource-card" href={`/founder-resources/${resource.slug}`} key={resource.slug}>
              <div className="meta">{resource.type}</div>
              <h3>{resource.title}</h3>
              <p>{resource.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
