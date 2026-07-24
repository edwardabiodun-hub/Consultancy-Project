import Link from "next/link";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="page-hero shell"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></header>;
}
export function DiagnosticCta() {
  return <section className="diagnostic-band"><div className="shell diagnostic-grid"><div><div className="eyebrow">Fixed-scope pilot</div><h2 className="display">Owner Independence Diagnostic</h2><p>Identify the dependencies holding your business back, prove one improvement, and leave with a prioritized 90-day action plan.</p><div className="facts"><div className="fact"><span>Duration</span><strong>10 business days</strong></div><div className="fact"><span>Pilot fee</span><strong>$3,500 fixed</strong></div><div className="fact"><span>Outcome</span><strong>One working proof</strong></div></div></div><div><p>This engagement diagnoses the system, prioritizes the work, and demonstrates one concrete improvement. It does not promise complete owner independence in ten days.</p><Link className="button" href="/diagnostic">See scope and deliverables →</Link></div></div></section>;
}
