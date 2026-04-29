"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  LayoutDashboard,
  ReceiptText,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AvatarToken, Badge, BrandMark } from "@/components/ui-kit";
import { WalletMiniControl } from "@/components/wallet-panel";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard#groups", label: "Groups", icon: WalletCards },
  { href: "/dashboard#create", label: "Create", icon: ReceiptText },
];

function isActiveNav(pathname: string, label: string) {
  if (pathname.startsWith("/groups") || pathname.startsWith("/workspaces")) {
    return label === "Groups";
  }
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
  const { isDemoUser, profile, signOut, user } = useAuth();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_42%,#eefdfa_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SplitSafe home">
            <BrandMark mobileCompact />
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
          <div className="flex items-center gap-2">
            {user ? (
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm xl:flex">
                <AvatarToken
                  name={profile?.name ?? profile?.email ?? "User"}
                  className="size-8 rounded-xl text-xs"
                />
                <div className="max-w-36">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {profile?.name ?? "SplitSafe user"}
                    </p>
                    {isDemoUser ? (
                      <Badge tone="teal" className="px-2 py-0.5 text-[10px]">
                        Demo
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {isDemoUser ? "Temporary account" : profile?.email ?? "Signed in"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="ml-1 flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Log out"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:-translate-y-0.5 xl:inline-flex"
              >
                Login
              </Link>
            )}
            <WalletMiniControl />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[248px_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[30px] border border-white/80 bg-white/75 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.07)] backdrop-blur-xl">
            <div className="mb-5 px-2">
              <BrandMark size="sm" />
            </div>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Group
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
                {eyebrow ?? "Private groups"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Create a group, scan expenses, ask AI, and settle when everyone
                is ready.
              </p>
            </div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
