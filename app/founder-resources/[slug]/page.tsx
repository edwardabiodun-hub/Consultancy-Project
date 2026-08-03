import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resourceArticles } from "../../../content/resource-articles";
import { resources } from "../../../content/resources";
import { Breadcrumbs } from "../../../components/SiteParts";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resource = resources.find((item) => item.slug === slug);
  if (!resource) return {};
  return {
    title: resource.title,
    description: resource.summary,
  };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = resources.find((item) => item.slug === slug);
  if (!resource) notFound();
  const article = resourceArticles[resource.slug];

  const headings = article?.blocks.filter((block) => block.kind === "heading").map((block) => block.text) ?? [];

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/founder-resources", label: "Insights" }, { label: resource.title }]} />
      <article className="content shell resource-body">
        <header className="page-hero">
          <div className="eyebrow">{resource.type}</div>
          <h1>{resource.title}</h1>
          <p>{article?.deck ?? resource.summary}</p>
          {article ? <p className="resource-reading-time">Estimated reading time: {article.readingTime}</p> : null}
        </header>

        {headings.length > 0 ? (
          <nav className="toc-card" aria-label="Article sections">
            <strong>In this piece</strong>
            <ol>
              {headings.slice(0, 6).map((heading) => (
                <li key={heading}><a href={`#${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}>{heading}</a></li>
              ))}
            </ol>
          </nav>
        ) : null}

        {article ? (
        article.blocks.map((block, index) => {
          if (block.kind === "heading") { const id = block.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); return <h2 id={id} key={index}>{block.text}</h2>; }
          if (block.kind === "quote") return <blockquote className="resource-quote" key={index}>{block.text}</blockquote>;
          if (block.kind === "divider") return <hr className="resource-divider" key={index} />;
          if (block.kind === "callout") {
            return (
              <aside className={`resource-callout ${block.tone ?? "takeaway"}`} key={index}>
                <div className="resource-callout-label">{block.label}</div>
                <p>{block.text}</p>
              </aside>
            );
          }
          if (block.kind === "table") {
            return (
              <div className="resource-table-wrap" key={index}>
                <table className="resource-table">
                  <thead>
                    <tr>{block.columns.map((column) => <th key={column}>{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join("|")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (block.kind === "image") {
            return (
              <figure className="resource-figure" key={index}>
                <img src={block.src} alt={block.alt} loading="lazy" />
                <figcaption>{block.caption}</figcaption>
              </figure>
            );
          }
          if (block.kind === "leadList") {
            return (
              <ul className="resource-lead-list" key={index}>
                {block.items.map((item) => <li key={item.lead}><strong>{item.lead}:</strong> {item.text}</li>)}
              </ul>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={index}>
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            );
          }
          return <p key={index}>{block.text}</p>;
        })
      ) : (
        <>
          <h2>The executive takeaway</h2>
          <p>
            Business independence grows when information, decisions, and critical work become visible and
            repeatable. The practical starting point is identifying the dependency that creates the most
            recurring pressure.
          </p>
          <h2>What to do next</h2>
          <div className="callout"><strong>{resource.action}</strong></div>
          <p>Use the result to locate the missing information, ownership, or operating rule. Improve the system before adding technology.</p>
        </>
      )}

      <div className="conversion-panel resource-next-step">
          <div className="eyebrow">Next step</div>
          <h2>Turn this insight into an operating signal.</h2>
          <p><strong>{resource.action}</strong></p>
          <div className="actions">
            <Link className="button" href="/assessment">Take the Assessment</Link>
            <Link className="button secondary" href="/diagnostic">Review the Diagnostic</Link>
          </div>
        </div>
      </article>
    </>
  );
}




