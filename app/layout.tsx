import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Edward Abiodun | Business Independence Advisory", template: "%s | Edward Abiodun" },
  description:
    "Helping owner-led businesses reduce founder dependency, improve executive decisions, and remove recurring operational friction.",
  icons: { icon: "/favicon.svg" },
  openGraph: { images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

const nav = [
  ["/assessment", "Take the assessment"],
  ["/diagnostic", "Reduce Owner Dependency"],
  ["/how-i-help", "Improve Executive Decisions"],
  ["/how-i-help#automation", "Automate Manual Operations"],
  ["/founder-resources", "Insights"],
  ["/about", "About Eddie"],
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/"><span>◆</span> EA Advisory</Link>
          <nav aria-label="Primary navigation">
            {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <Link className="nav-cta" href="/contact">Start a Conversation</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <div>
            <strong>Edward Abiodun Advisory</strong>
            <p>Business independence through executive visibility, operating systems, and practical automation.</p>
          </div>
          <div className="footer-links">
            {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <Link href="/contact">Start a Conversation</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <p className="boundary">
            Independent advisory work only. No confidential employer information is used, and engagements
            within prohibited competitive areas are not accepted.
          </p>
        </footer>
      </body>
    </html>
  );
}
