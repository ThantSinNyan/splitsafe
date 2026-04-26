import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg";

const logoSizes = {
  sm: {
    icon: "size-8 rounded-xl",
    imageSize: 32,
    title: "text-sm",
    subtitle: "text-[11px]",
    gap: "gap-2.5",
  },
  md: {
    icon: "size-12 rounded-2xl",
    imageSize: 48,
    title: "text-base",
    subtitle: "text-xs",
    gap: "gap-3",
  },
  lg: {
    icon: "size-20 rounded-[28px]",
    imageSize: 80,
    title: "text-2xl",
    subtitle: "text-sm",
    gap: "gap-4",
  },
} satisfies Record<
  LogoSize,
  {
    icon: string;
    imageSize: number;
    title: string;
    subtitle: string;
    gap: string;
  }
>;

export function Logo({
  size = "md",
  compact = false,
  className,
}: {
  size?: LogoSize;
  compact?: boolean;
  className?: string;
}) {
  const config = logoSizes[size];

  return (
    <div className={cn("flex min-w-0 items-center", config.gap, className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/70",
          config.icon,
        )}
      >
        <Image
          src="/splitsafe-logo.png"
          width={config.imageSize}
          height={config.imageSize}
          alt="SplitSafe logo"
          className="h-full w-full object-contain"
          priority={size === "lg"}
        />
      </div>
      {!compact ? (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-semibold tracking-tight text-slate-950",
              config.title,
            )}
          >
            SplitSafe
          </p>
          <p
            className={cn(
              "truncate font-medium text-slate-500",
              config.subtitle,
            )}
          >
            Onchain group finance
          </p>
        </div>
      ) : null}
    </div>
  );
}
