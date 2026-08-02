import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resourceArticles } from "../../../content/resource-articles";
import { resources } from "../../../content/resources";

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

  return (
    <article className="content shell resource-body">
      <header className="page-hero">
        <div className="eyebrow">{resource.type}</div>
        <h1>{resource.title}</h1>
        <p>{article?.deck ?? resource.summary}</p>
        {article ? <p className="resource-reading-time">Estimated reading time: {article.readingTime}</p> : null}
      </header>

      {article ? (
        article.blocks.map((block, index) => {
          if (block.kind === "heading") return <h2 key={index}>{block.text}</h2>;
          if (block.kind === "quote") return <blockquote key={index}>{block.text}</blockquote>;
          if (block.kind === "callout") return <div className="callout" key={index}><strong>{block.text}</strong></div>;
          if (block.kind === "image") {
            return (
              <figure className="resource-figure" key={index}>
                <img src={block.src} alt={block.alt} loading="lazy" />
                <figcaption>{block.caption}</figcaption>
              </figure>
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

      <h2>What to do next</h2>
      <div className="callout"><strong>{resource.action}</strong></div>
      <Link className="button" href="/diagnostic">Review the Business Independence Diagnostic →</Link>
    </article>
  );
}
