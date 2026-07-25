import Link from "next/link";

export default function ThankYou() {
  return (
    <div className="content shell page-hero">
      <div className="eyebrow">Inquiry received</div>
      <h1>Thank you. I’ll review the context.</h1>
      <p>Expect a response within two business days.</p>
      <Link className="button" href="/founder-resources">Explore Insights</Link>
    </div>
  );
}
