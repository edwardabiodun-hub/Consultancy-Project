import Link from "next/link";
import { Breadcrumbs, PageHero } from "../../components/SiteParts";
import { categories, resources } from "../../content/resources";

export const metadata = {
  title: "Insights",
  description: "Videos and practical guides for building a less owner-dependent business.",
};

export default function Insights() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Insights" }]} />
      <PageHero eyebrow="Insights" title="Practical thinking for a business that can run without you.">
        Organized around the executive problem you are trying to solve, not publication date or content format.
      </PageHero>
      <div className="shell callout">
        <div className="eyebrow">Free scorecard</div>
        <h2>Can your business run without you?</h2>
        <p>Use 15 questions to identify where information, decisions, relationships, and critical work still depend on the owner.</p>
        <a className="button secondary" href="/owner-independence-scorecard.pdf" download>Download the Scorecard</a>
      </div>
      <section className="shell conversion-panel" aria-labelledby="start-here-heading">
        <div className="eyebrow">Start here if</div>
        <h2 id="start-here-heading">Choose the pressure point you recognize first.</h2>
        <div className="signal-strip">
          <a className="signal-card" href="#run-without-you"><strong>You are the bottleneck</strong><span>Founder-held knowledge, approvals, or relationships still run the business.</span></a>
          <a className="signal-card" href="#executive-visibility"><strong>Reports are slow</strong><span>Leaders assemble the truth manually before decisions can happen.</span></a>
          <a className="signal-card" href="#operational-friction"><strong>Automation feels messy</strong><span>Workflows, ownership, and exceptions are unclear before tools enter the picture.</span></a>
        </div>
      </section>
      <div className="content shell">
        {categories.map((category) => (
          <section className="category" id={category.id} key={category.id}>
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
                  <strong>Explore</strong>
                </Link>
              ))}
              {category.id === "run-without-you" ? (() => {
                const featuredVideo = resources.find((resource) => resource.slug === "one-big-client-risk");
                return featuredVideo && "youtubeEmbedUrl" in featuredVideo && featuredVideo.youtubeEmbedUrl ? (
                  <div className="resource-card resource-video-card">
                    <div className="meta">Featured video</div>
                    <h3>{featuredVideo.title}</h3>
                    <div className="video-embed" aria-label={`${featuredVideo.title} video`}>
                      <iframe
                        src={featuredVideo.youtubeEmbedUrl}
                        title={featuredVideo.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    {"youtubeUrl" in featuredVideo && featuredVideo.youtubeUrl ? (
                      <a className="resource-video-link" href={featuredVideo.youtubeUrl} target="_blank" rel="noreferrer">Watch on YouTube</a>
                    ) : null}
                  </div>
                ) : null;
              })() : null}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}





