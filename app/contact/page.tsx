import { Breadcrumbs, PageHero } from "../../components/SiteParts";
import ContactForm from "./ContactForm";

export const metadata = {
  title: "Start a Conversation",
  description: "Discuss a recurring owner dependency and determine whether a Business Independence Diagnostic is appropriate.",
};

export default function Contact() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Start a Conversation" }]} />
      <PageHero eyebrow="Start a conversation" title="Describe what keeps coming back to you.">
        Share the recurring dependency, its operating context, and what you want to change. The first
        conversation determines whether the Business Independence Diagnostic is an appropriate next step.
      </PageHero>
      <div className="content shell contact-grid">
        <aside className="conversion-panel">
          <h2>What happens next</h2>
          <ol>
            <li>I review the operating context and qualification information.</li>
            <li>I respond within two business days.</li>
            <li>If there is a potential fit, we schedule a focused discovery conversation.</li>
            <li>Scope and investment are confirmed only after that conversation.</li>
          </ol>
          <p>Your information is used only to evaluate and respond to this inquiry.</p>
        </aside>
        <ContactForm />
      </div>
    </>
  );
}




