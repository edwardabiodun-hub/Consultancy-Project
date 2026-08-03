import Link from "next/link";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="page-hero shell"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></header>;
}


export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav className="breadcrumbs shell" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BackToTop() {
  return <a className="back-to-top" href="#top" aria-label="Back to top">↑</a>;
}

export function SectionNav({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <nav className="section-nav shell" aria-label="Page sections">
      {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
    </nav>
  );
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
          <p><Link className="button" href="/assessment">Take the Assessment</Link></p>
          <Link className="button" href="/diagnostic">Review the assessment â†’</Link>
        </div>
      </div>
    </section>
  );
}



