import Link from "next/link";
import { PageHero } from "../../components/SiteParts";

export const metadata = {
  title: "Business Independence Diagnostic",
  description:
    "A focused two-week assessment of the dependencies, operating costs, and management changes required to reduce owner involvement.",
};

const costAreas = [
  ["Founder intervention time", "Hours absorbed by recurring approvals, escalation, reporting, and exception handling."],
  ["Decision and approval delays", "Work that waits, slows, or changes direction because authority remains concentrated."],
  ["Rework and reporting effort", "Leadership time spent reconciling information, rebuilding reports, or correcting unclear handoffs."],
  ["Relationship concentration", "Revenue, delivery, or stakeholder risk held primarily through the owner's personal involvement."],
];

export default function Diagnostic() {
  return (
    <>
      <PageHero
        eyebrow="Focused executive assessment"
        title="In two weeks, identify where your business still depends on you."
      >
        Estimate the operational cost of that dependency and leave with a prioritized plan for reducing
        owner involvement—without beginning with a software or AI recommendation.
      </PageHero>

      <div className="content shell">
        <div className="callout">
          <div className="eyebrow">Business Independence Diagnostic</div>
          <h2>10 business days · dependency and cost assessment · prioritized 90-day plan</h2>
          <p>
            One clearly bounded engagement designed to establish what is happening, why it matters, and
            where management attention will create the greatest leverage.
          </p>
        </div>

        <h2>Designed for observable operating complexity</h2>
        <ul>
          <li>Owner-led B2B businesses, typically with approximately 20–100 employees and multiple managers.</li>
          <li>Recurring decisions still escalate to the owner despite an established leadership team.</li>
          <li>Reporting is assembled manually, arrives late, or produces competing versions of performance.</li>
          <li>Critical knowledge, relationships, or approvals remain concentrated in the owner.</li>
          <li>Leadership is prepared to change decision rights, accountability, and operating cadence.</li>
        </ul>

        <h2>What we examine</h2>
        <div className="process-grid">
          {["Executive information and KPIs", "Critical workflows and handoffs", "Decision, ownership, and escalation paths"].map((item, index) => (
            <div className="process-step" key={item}>
              <div className="utility">0{index + 1}</div>
              <h3>{item}</h3>
            </div>
          ))}
        </div>

        <h2>How we estimate the operational cost</h2>
        <p>
          The assessment does not manufacture a precise ROI figure. It develops a defensible estimate using
          the recurring time, delay, rework, and concentration risks visible in the business.
        </p>
        <div className="cost-grid">
          {costAreas.map(([title, copy]) => (
            <article className="cost-item" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>

        <h2>What you receive</h2>
        <ul>
          <li>Business Dependency Scorecard and executive dependency map</li>
          <li>Operational-cost estimate with assumptions made explicit</li>
          <li>Prioritized management-system, documentation, and automation opportunities</li>
          <li>One redesigned workflow or executive-reporting prototype</li>
          <li>90-day implementation roadmap and executive readout</li>
        </ul>

        <h2>What this assessment does not promise</h2>
        <p>
          It does not promise complete business independence or a guaranteed financial return in two weeks.
          It identifies the highest-value dependencies, estimates their operational impact, and establishes
          a practical sequence for change.
        </p>

        <h2>What may follow</h2>
        <div className="process-grid">
          <div className="process-step">
            <div className="utility">Build</div>
            <h3>Executive Operating System</h3>
            <p>Implementation support is available when the findings justify changes to reporting, decision rights, workflows, or operating cadence.</p>
          </div>
          <div className="process-step">
            <div className="utility">Sustain</div>
            <h3>Executive Operations & AI Advisory</h3>
            <p>Ongoing advisory support is available when the findings justify continued executive guidance and responsible automation.</p>
          </div>
          <div className="process-step">
            <div className="utility">Boundary</div>
            <h3>No automatic upsell</h3>
            <p>The Diagnostic stands on its own. Further work is recommended only when there is a defined business case.</p>
          </div>
        </div>

        <div className="investment">
          <div className="eyebrow">Investment</div>
          <h2>Scoped to the operating complexity—not a public price anchor.</h2>
          <p>
            Investment is confirmed after an initial discovery conversation based on organizational
            complexity, the number of stakeholders, and the operating areas being assessed.
          </p>
        </div>

        <div className="faq">
          <h3>Will I need to replace my existing software?</h3>
          <p>No. The work starts with the operating problem and uses existing tools wherever they are adequate.</p>
        </div>
        <div className="faq">
          <h3>Is this an AI implementation?</h3>
          <p>Not by default. AI or automation is applied only where the workflow is clear and the business case is defensible.</p>
        </div>
        <Link className="button" href="/contact">Discuss your business dependency →</Link>
      </div>
    </>
  );
}
