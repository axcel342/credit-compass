"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [["/", "Overview"], ["/charges", "Charges"], ["/recovery", "Recovery"], ["/optimize", "Optimize spend"]] as const;

export function NavTabs() {
  const path = usePathname();
  const q = useSearchParams().get("period") === "30d" ? "?period=30d" : "";
  return (
    <nav aria-label="Screens" className="tabs">
      {TABS.map(([href, label]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={`${href}${q}`} aria-current={on ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
