import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  Scale,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Badge,
  BrandMark,
  LinkArrow,
  ProgressBar,
  SectionCard,
  SectionHeader,
} from "@/components/ui-kit";
import {
  defaultSettlementNetwork,
} from "@/lib/networks";

const features = [
  {
    title: "Group budgets",
    description: "Create private groups for dinners, trips, dorms, families, and small teams.",
    icon: WalletCards,
  },
  {
    title: "Smart splits",
    description: "Record expenses, split equally, and turn messy reimbursements into clear balances.",
    icon: Scale,
  },
  {
    title: "Checkout settlement",
    description: "Clear balances with simple checkout-style payment records.",
    icon: Landmark,
  },
  {
    title: "AI spending brief",
    description: "Ask what happened, who still owes, and where the group is burning budget.",
    icon: Bot,
  },
];

const useCases = ["Friends", "Trips", "Roommates", "Family", "Small teams"];

const steps = [
  "Create a private group",
  "Invite members by email",
  "Scan or add expenses",
  "Settle when ready",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <section className="relative border-b border-slate-200/70 bg-[radial-gradient(circle_at_12%_14%,rgba(20,184,166,0.12),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(56,189,248,0.10),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_64%,#f0fdfa_100%)]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <nav className="flex min-w-0 items-center justify-between gap-3">
            <Link href="/" aria-label="SplitSafe home" className="min-w-0">
              <BrandMark mobileCompact size="lg" />
            </Link>
            <div className="hidden items-center gap-6 text-sm font-semibold text-slate-500 md:flex">
              <a href="#features" className="hover:text-slate-950">
                Features
              </a>
              <a href="#how" className="hover:text-slate-950">
                How it works
              </a>
              <a href="#use-cases" className="hover:text-slate-950">
                Use cases
              </a>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:bg-slate-800 sm:px-4"
            >
              Launch App
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </nav>

          <div className="grid grid-cols-1 items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div className="min-w-0 max-w-2xl">
              <Badge tone="teal" className="bg-white/80 shadow-sm">
                <Sparkles className="size-3.5" aria-hidden="true" />
                AI + wallets for shared spending
              </Badge>
              <h1 className="mt-6 max-w-full text-4xl font-semibold leading-[1.02] tracking-tight text-slate-950 sm:max-w-2xl sm:text-5xl lg:text-6xl">
                Split expenses with AI, receipts, and simple settlement.
              </h1>
              <p className="mt-6 max-w-full text-base leading-8 text-slate-600 sm:max-w-xl sm:text-lg">
                Create private groups, scan receipts or payment slips, see who
                owes who, and settle faster.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(15,23,42,0.20)] hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto"
                >
                  Launch App
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/85 px-6 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur hover:-translate-y-0.5 hover:border-slate-300 sm:w-auto"
                >
                  See product flow
                </a>
              </div>
              <div className="mt-10 grid max-w-full grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-3">
                <HeroMetric label="Budget" value="100 USDC" />
                <HeroMetric label="Spent" value="30 USDC" />
                <HeroMetric label="Unpaid" value="2 balances" />
              </div>
            </div>

            <div className="flex min-w-0 justify-center lg:justify-end">
              <ProductPreview />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeader
          eyebrow="Core product"
          title="A cleaner operating system for shared money"
          description="SplitSafe brings the tracking, explanation, and settlement pieces into one calm finance surface."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <SectionCard key={feature.title} className="p-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 text-teal-700">
                <feature.icon className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-tight text-slate-950">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {feature.description}
              </p>
            </SectionCard>
          ))}
        </div>
      </section>

      <section id="how" className="bg-slate-950 py-24 text-white">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <Badge tone="teal" className="border-white/10 bg-white/10 text-teal-100">
                Account-ready flow
              </Badge>
              <h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
                From dinner receipt to settled balance in minutes.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-300">
                SplitSafe keeps the main flow simple: create a group, invite
                members, scan or add an expense, ask AI, and settle a balance.
              </p>
              <Link href="/dashboard" className="mt-8 inline-flex">
                <span className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-slate-950 hover:-translate-y-0.5">
                  Start app
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[26px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl"
                >
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-400 text-sm font-bold text-slate-950">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {index === 0
                      ? "Set the shared budget and currency."
                      : index === 1
                        ? "Share an invite link or add a member by email."
                        : index === 2
                          ? "Review extracted details before saving."
                          : "Record a clean payment receipt when done."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeader
            eyebrow="Use cases"
            title="Designed for real group spending, not only crypto natives"
            description="The product speaks in simple budget language while preserving wallet-native settlement underneath."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {useCases.map((useCase) => (
              <div
                key={useCase}
                className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Users className="size-5" aria-hidden="true" />
                  </div>
                  <span className="font-semibold text-slate-950">{useCase}</span>
                </div>
                <LinkArrow label="Fit" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50/80">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-16 sm:px-8 lg:grid-cols-3">
          <ValueItem
            title="Payment ready"
            body={`Wallet settlement is prepared on ${defaultSettlementNetwork.shortLabel}, with manual records when no wallet is connected.`}
          />
          <ValueItem title="AI resilient" body="Falls back to deterministic summaries without API keys." />
          <ValueItem title="Private groups" body="Only approved members can open group expenses, balances, and invites." />
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <BrandMark />
        <p>Built for shared spending teams.</p>
      </footer>
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="w-full max-w-full rounded-[32px] border border-white/90 bg-white/85 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:max-w-xl sm:p-4">
      <div className="rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
              Private group
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              Thailand Trip
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              3 members · settlement ready
            </p>
          </div>
          <Badge tone="green">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            On budget
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PreviewStat icon={CircleDollarSign} label="Budget" value="100" />
          <PreviewStat icon={ReceiptText} label="Spent" value="30" />
          <PreviewStat icon={Landmark} label="Unpaid" value="20" />
        </div>

        <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Budget usage</span>
            <span className="font-semibold text-teal-700">30%</span>
          </div>
          <ProgressBar value={30} className="mt-3" />
        </div>

        <div className="mt-4 grid gap-3">
          <BalancePreview name="Alex" amount="10 USDC" />
          <BalancePreview name="May" amount="10 USDC" />
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-4">
      <Icon className="size-5 text-teal-600" aria-hidden="true" />
      <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
        {value} <span className="text-sm text-slate-400">USDC</span>
      </p>
    </div>
  );
}

function BalancePreview({ name, amount }: { name: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-2xl bg-slate-950 text-xs font-semibold text-white">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-950">{name} owes Thant</p>
          <p className="text-xs text-slate-500">Unpaid split</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-slate-950">{amount}</span>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.06)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ValueItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <CheckCircle2 className="size-6 text-teal-600" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}
