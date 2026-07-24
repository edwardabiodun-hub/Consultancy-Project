import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Edward Abiodun | Founder Independence Advisory", template: "%s | Edward Abiodun" },
  description: "Helping founder-led businesses improve management visibility, document critical workflows, and reduce owner dependence through practical automation.",
  icons: { icon: "/favicon.svg" },
  openGraph: { images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

const nav = [
  ["/diagnostic", "Diagnostic"],
  ["/how-i-help", "How I Help"],
  ["/founder-resources", "Founder Resources"],
  ["/about", "About"],
  ["/contact", "Contact"],
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/"><span>◆</span> EA Advisory</Link>
          <nav aria-label="Primary navigation">
            {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <Link className="nav-cta" href="/diagnostic">Owner Independence Diagnostic</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <div><strong>Edward Abiodun Advisory</strong><p>Founder independence through better visibility, operating systems, and practical automation.</p></div>
          <div className="footer-links">{nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/privacy">Privacy</Link></div>
          <p className="boundary">Independent advisory work only. No confidential employer information is used, and engagements within prohibited competitive areas are not accepted.</p>
        </footer>
      </body>
    </html>
  );
}
