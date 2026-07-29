import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      aria-label="RunRate Advisory home"
      className={`brand ${className}`.trim()}
      href="/"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="brand-mark"
        height="56"
        src="/brand/runrate-icon.svg"
        width="56"
      />
      <span className="brand-wordmark">
        <span className="brand-name">RUNRATE</span>
        <span className="brand-descriptor">ADVISORY</span>
      </span>
    </Link>
  );
}
