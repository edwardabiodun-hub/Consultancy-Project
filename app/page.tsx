import Link from "next/link";
import { DiagnosticCta } from "../components/SiteParts";
import { resources } from "../content/resources";

export default function Home() {
  return <>
    <section className="shell hero">
      <div><div className="eyebrow">Founder Independence & Decision Systems</div><h1>Build a business that runs on systems—not constant intervention from you.</h1><p className="lede">Improve management visibility, capture critical operating knowledge, and remove recurring friction with practical automation.</p><div className="actions"><Link className="button" href="/diagnostic">Review the Diagnostic →</Link><Link className="button secondary" href="/founder-resources">Explore Founder Resources →</Link></div></div>
      <aside className="decision-margin" aria-label="Decision Margin"><div className="vertical">Decision Margin</div><h3>What changes</h3><p>Decisions move with the business—not back to the founder.</p><h3>What remains</h3><p>Your judgment, applied where it creates the most value.</p></aside>
    </section>
    <section className="recognition"><div className="shell recognition-grid"><div><div className="eyebrow">Recognize the pattern</div><h2>When the founder is still the operating system.</h2></div><div><h3>Visibility</h3><p>You assemble the real picture because reports arrive late or conflict.</p></div><div><h3>Knowledge</h3><p>Critical context lives in conversations, inboxes, and memory.</p></div><div><h3>Friction</h3><p>Routine approvals and recurring work return to you.</p></div></div></section>
    <section className="section shell"><div className="section-head"><div><div className="eyebrow">Three operating levers</div><h2>Make independence practical.</h2></div><p>Not a wholesale transformation. A focused effort to make information clearer, work repeatable, and decisions easier to delegate.</p></div><div className="lever-grid"><div className="lever"><h3>Management visibility</h3><p>A small, decision-ready view of performance, risk, and next actions.</p></div><div className="lever"><h3>Operating knowledge</h3><p>Turn what experienced people know into workflows others can follow.</p></div><div className="lever"><h3>Practical automation</h3><p>Remove recurring handoffs and reporting work after the process is clear.</p></div></div></section>
    <DiagnosticCta />
    <section className="section shell"><div className="section-head"><div><div className="eyebrow">Founder resources</div><h2>Start with the pressure point.</h2></div><Link href="/founder-resources">View all resources →</Link></div><div className="resource-grid">{resources.slice(0,3).map(r=><Link className="resource-card" href={`/founder-resources/${r.slug}`} key={r.slug}><div className="meta">{r.type}</div><h3>{r.title}</h3><p>{r.summary}</p></Link>)}</div></section>
  </>;
}
