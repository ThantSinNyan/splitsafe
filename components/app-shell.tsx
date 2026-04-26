"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { BrandMark } from "@/components/ui-kit";
import { WalletMiniControl } from "@/components/wallet-panel";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard#groups", label: "Groups", icon: WalletCards },
  { href: "/dashboard#create", label: "Create", icon: ReceiptText },
];

function isActiveNav(pathname: string, label: string) {
  if (pathname.startsWith("/groups")) return label === "Groups";
  if (pathname === "/dashboard") return label === "Dashboard";
  return false;
}

export function AppShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_42%,#eefdfa_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SplitSafe home">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm lg:flex">
            {navItems.map((item) => {
              const active = isActiveNav(pathname, item.label);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950",
                    active && "bg-slate-950 text-white shadow-sm hover:bg-slate-950 hover:text-white",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <WalletMiniControl />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[248px_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[30px] border border-white/80 bg-white/75 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.07)] backdrop-blur-xl">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>
            <div className="mt-4 space-y-1">
              {navItems.map((item) => {
                const active = isActiveNav(pathname, item.label);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950",
                      active && "bg-slate-950 text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)] hover:bg-slate-950 hover:text-white",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 overflow-hidden rounded-[24px] border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-950">
                {eyebrow ?? "Hackathon demo mode"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Testnet-only settlements, AI fallback, and local demo storage keep the
                flow resilient.
              </p>
            </div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
