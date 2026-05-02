import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg";

const logoSizes = {
  sm: {
    iconClassName: "size-8",
    fullClassName: "h-8 gap-2",
    textClassName: "text-xl",
    iconImageSize: 32,
  },
  md: {
    iconClassName: "size-12",
    fullClassName: "h-12 gap-3",
    textClassName: "text-2xl",
    iconImageSize: 48,
  },
  lg: {
    iconClassName: "size-12 sm:size-20",
    fullClassName: "h-12 gap-3 sm:h-20 sm:gap-4",
    textClassName: "text-2xl sm:text-5xl",
    iconImageSize: 80,
  },
} satisfies Record<
  LogoSize,
  {
    iconClassName: string;
    fullClassName: string;
    textClassName: string;
    iconImageSize: number;
  }
>;

export function Logo({
  size = "md",
  compact = false,
  mobileCompact = false,
  className,
}: {
  size?: LogoSize;
  compact?: boolean;
  mobileCompact?: boolean;
  className?: string;
}) {
  const config = logoSizes[size];

  if (mobileCompact && !compact) {
    return (
      <div className={cn("flex min-w-0 items-center", className)}>
        <Logo compact size={size} className="sm:hidden" />
        <Logo size={size} className="hidden sm:block" />
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full",
          config.iconClassName,
          className,
        )}
      >
        <Image
          src="/splitsafe-logo.png"
          width={config.iconImageSize}
          height={config.iconImageSize}
          alt="SplitSafe logo"
          className="h-full w-full object-contain"
          priority={size === "lg"}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 items-center",
        config.fullClassName,
        className,
      )}
    >
      <div className={cn("relative shrink-0 overflow-hidden rounded-full", config.iconClassName)}>
        <Image
          src="/splitsafe-logo.png"
          width={config.iconImageSize}
          height={config.iconImageSize}
          alt=""
          className="h-full w-full object-contain"
          priority={size === "lg"}
        />
      </div>
      <span
        className={cn(
          "truncate font-bold leading-none tracking-normal text-slate-950",
          config.textClassName,
        )}
      >
        SplitSafe
      </span>
    </div>
  );
}
