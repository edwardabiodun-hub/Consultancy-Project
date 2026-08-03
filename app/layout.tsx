import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { BackToTop } from "../components/SiteParts";
import { Logo } from "../components/Logo";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "RunRate Advisory | Business Independence & Decision Systems",
    template: "%s | RunRate Advisory",
  },
  description:
    "Helping owner-led businesses reduce founder dependency, improve executive decisions, and remove recurring operational friction.",
  openGraph: { images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

const outcomeNav = [
  ["/how-i-help#dependency", "Reduce Owner Dependency"],
  ["/how-i-help#decisions", "Improve Executive Decisions"],
  ["/how-i-help#automation", "Automate Manual Operations"],
] as const;

const primaryNav = [
  ["/founder-resources", "Insights"],
  ["/about", "About Eddie"],
] as const;

const footerNav = [
  ["/how-i-help", "How I Help"],
  ...outcomeNav,
  ...primaryNav,
  ["/assessment", "Take the Assessment"],
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>
        <div id="top" />
        <header className="site-header">
          <Logo />
          <nav aria-label="Primary navigation">
            <details className="nav-menu">
              <summary>How I Help</summary>
              <div className="nav-menu-panel">
                {outcomeNav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
              </div>
            </details>
            {primaryNav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <Link className="nav-primary" href="/assessment">Take the Assessment</Link>
            <Link className="nav-cta" href="/contact">Start a Conversation</Link>
          </nav>
        </header>
        <main>{children}</main>
        <BackToTop />
        <footer>
          <div>
            <strong className="footer-brand">RunRate Advisory</strong>
            <p>Business independence through executive visibility, operating systems, and practical automation.</p>
          </div>
          <div className="footer-links">
            {footerNav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
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

