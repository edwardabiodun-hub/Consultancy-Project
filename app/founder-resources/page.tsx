import Link from "next/link";
import { PageHero } from "../../components/SiteParts";
import { categories, resources } from "../../content/resources";

export const metadata = {
  title: "Insights",
  description: "Videos and practical guides for building a less owner-dependent business.",
};

export default function Insights() {
  return (
    <>
      <PageHero eyebrow="Insights" title="Practical thinking for a business that can run without you.">
        Organized around the executive problem you are trying to solve—not publication date or content format.
      </PageHero>
      <div className="shell callout">
        <div className="eyebrow">Free scorecard</div>
        <h2>Can your business run without you?</h2>
        <p>Use 15 questions to identify where information, decisions, relationships, and critical work still depend on the owner.</p>
        <a className="button secondary" href="/owner-independence-scorecard.pdf" download>Download the Scorecard →</a>
      </div>
      <div className="content shell">
        {categories.map((category) => (
          <section className="category" key={category.id}>
            <div className="section-head">
              <div><div className="eyebrow">Insight pathway</div><h2>{category.title}</h2></div>
              <p>{category.description}</p>
            </div>
            <div className="resource-grid">
              {resources.filter((resource) => resource.category === category.id).map((resource) => (
                <Link className="resource-card" href={`/founder-resources/${resource.slug}`} key={resource.slug}>
                  <div className="meta">{resource.type}</div>
                  <h3>{resource.title}</h3>
                  <p>{resource.summary}</p>
                  <strong>Explore →</strong>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
