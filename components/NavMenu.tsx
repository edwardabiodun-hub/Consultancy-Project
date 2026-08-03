"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type NavMenuProps = {
  label: string;
  links: readonly (readonly [href: string, label: string])[];
};

export function NavMenu({ label, links }: NavMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu() {
      const menu = menuRef.current;
      if (menu) menu.open = false;
    }

    function handlePointerDown(event: PointerEvent) {
      const menu = menuRef.current;
      if (!menu?.open) return;
      if (event.target instanceof Node && !menu.contains(event.target)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !menuRef.current?.open) return;
      closeMenu();
      menuRef.current?.querySelector("summary")?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details className="nav-menu" ref={menuRef}>
      <summary>{label}</summary>
      <div className="nav-menu-panel">
        {links.map(([href, linkLabel]) => <Link key={href} href={href}>{linkLabel}</Link>)}
      </div>
    </details>
  );
}