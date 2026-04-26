import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg";

const logoSizes = {
  sm: {
    iconClassName: "size-8",
    fullClassName: "h-8 w-[122px]",
    iconImageSize: 32,
    fullImageWidth: 320,
    fullImageHeight: 84,
  },
  md: {
    iconClassName: "size-12",
    fullClassName: "h-12 w-[183px]",
    iconImageSize: 48,
    fullImageWidth: 480,
    fullImageHeight: 126,
  },
  lg: {
    iconClassName: "size-12 sm:size-20",
    fullClassName: "h-12 w-[183px] sm:h-20 sm:w-[305px]",
    iconImageSize: 80,
    fullImageWidth: 800,
    fullImageHeight: 210,
  },
} satisfies Record<
  LogoSize,
  {
    iconClassName: string;
    fullClassName: string;
    iconImageSize: number;
    fullImageWidth: number;
    fullImageHeight: number;
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
      <div className={cn("relative shrink-0", config.iconClassName, className)}>
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
        "relative min-w-0 shrink-0",
        config.fullClassName,
        className,
      )}
    >
      <Image
        src="/splitsafe-logo-full.png"
        width={config.fullImageWidth}
        height={config.fullImageHeight}
        alt="SplitSafe logo"
        className="h-full w-full object-contain"
        priority={size === "lg"}
      />
    </div>
  );
}
