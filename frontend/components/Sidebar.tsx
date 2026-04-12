"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  GitBranch,
  Search,
  BookOpen,
  Settings,
  Dna,
  FlaskConical,
  type LucideProps,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<LucideProps>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/",         icon: LayoutDashboard },
  { label: "Pipeline",    href: "/pipeline", icon: GitBranch       },
  { label: "Explorer",    href: "/explorer", icon: Search          },
  { label: "Studies",     href: "/studies",  icon: BookOpen        },
  { label: "Virtual Lab", href: "/lab",      icon: FlaskConical, badge: "AI" },
  { label: "Settings",    href: "/settings", icon: Settings        },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-[220px] flex-shrink-0 flex-col border-r border-slate-200 bg-white"
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-700">
          <Dna size={15} className="text-white" />
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-900 leading-tight">LatticeBio</span>
          <span className="block text-[10px] text-slate-400 uppercase tracking-widest">Virtual Wet Lab</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-4" role="navigation">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Workspace
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-700"
                />
              )}
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 tracking-wide">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="h-7 w-7 flex-shrink-0 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-[11px] font-bold text-brand-700">R</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">Researcher</p>
            <p className="text-[10px] text-slate-400 truncate">Local instance</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
