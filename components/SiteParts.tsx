import Link from "next/link";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="page-hero shell"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></header>;
}

export function DiagnosticCta() {
  return (
    <section className="diagnostic-band">
      <div className="shell diagnostic-grid">
        <div>
          <div className="eyebrow">Focused executive assessment</div>
          <h2 className="display">Business Independence Diagnostic</h2>
          <p>
            In two weeks, identify where the business still depends on you, estimate the operational cost
            of that dependency, and leave with a prioritized plan for reducing owner involvement.
          </p>
          <div className="facts">
            <div className="fact"><span>Duration</span><strong>10 business days</strong></div>
            <div className="fact"><span>Assessment</span><strong>Cost and dependency map</strong></div>
            <div className="fact"><span>Outcome</span><strong>Prioritized 90-day plan</strong></div>
          </div>
        </div>
        <div>
          <p>
            Investment is confirmed after a discovery conversation based on organizational complexity,
            stakeholders, and the operating areas being assessed.
          </p>
          <Link className="button" href="/diagnostic">Review the assessment →</Link>
        </div>
      </div>
    </section>
  );
}
