import Link from "next/link";
import { notFound } from "next/navigation";
import { resources } from "../../../content/resources";

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = resources.find((item) => item.slug === slug);
  if (!resource) notFound();

  return (
    <article className="content shell resource-body">
      <header className="page-hero">
        <div className="eyebrow">{resource.type}</div>
        <h1>{resource.title}</h1>
        <p>{resource.summary}</p>
      </header>
      <h2>The executive takeaway</h2>
      <p>
        Business independence grows when information, decisions, and critical work become visible and
        repeatable. The practical starting point is identifying the dependency that creates the most
        recurring pressure.
      </p>
      <h2>What to do next</h2>
      <div className="callout"><strong>{resource.action}</strong></div>
      <p>Use the result to locate the missing information, ownership, or operating rule. Improve the system before adding technology.</p>
      <Link className="button" href="/diagnostic">Review the Business Independence Diagnostic →</Link>
    </article>
  );
}
