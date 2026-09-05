"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Today",
    icon: "M3 12.5 12 4l9 8.5M6 11v8h12v-8",
  },
  {
    href: "/activities",
    label: "Activity",
    icon: "M3 13h4l2.5-6 4 12L16 13h5",
  },
  {
    href: "/more",
    label: "More",
    icon: "M5 12h.01M12 12h.01M19 12h.01",
  },
] as const;

/** Hidden on the pages that are not part of the signed-in app. */
const HIDDEN_ON = ["/login", "/setup"];

export function TabBar() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "tab active" : "tab"} aria-current={active ? "page" : undefined}>
            <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden>
              <path
                d={tab.icon}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
