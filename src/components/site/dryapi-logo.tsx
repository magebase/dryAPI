import { cn } from "@/lib/utils";

type DryApiLogoProps = {
  mark?: string;
  name?: string;
  suffix?: string;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  suffixClassName?: string;
  markDataTinaField?: string;
  nameDataTinaField?: string;
};

const SIZE_STYLES: Record<
  NonNullable<DryApiLogoProps["size"]>,
  { icon: string; mark: string; name: string; suffix: string }
> = {
  sm: {
    icon: "size-7 text-[12px]",
    mark: "text-xl",
    name: "text-[10px] tracking-[0.16em]",
    suffix: "text-[10px] px-2 py-0.5",
  },
  md: {
    icon: "size-16 text-[14px]",
    mark: "text-[1.7rem]",
    name: "text-[11px] tracking-[0.18em]",
    suffix: "text-[11px] px-2.5 py-1",
  },
  lg: {
    icon: "size-9 text-[16px]",
    mark: "text-[2rem] md:text-[2.25rem]",
    name: "text-xs tracking-[0.2em]",
    suffix: "text-[11px] px-2.5 py-1",
  },
};

export function DryApiLogo({
  mark = "dryAPI",
  name,
  suffix,
  tone = "dark",
  size = "md",
  className,
  markClassName,
  nameClassName,
  suffixClassName,
  markDataTinaField,
  nameDataTinaField,
}: DryApiLogoProps) {
  const sizeStyles = SIZE_STYLES[size];
  const isDarkTone = tone === "dark";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary via-accent to-[color:var(--cta-cool-b)] font-extrabold tracking-[0.18em] text-primary-foreground shadow-lg",
          sizeStyles.icon,
        )}
      >
        dA
      </span>

      <span className="inline-flex items-center gap-2.5 leading-none">
        <span
          className={cn(
            "font-heading font-extrabold tracking-[-0.028em]",
            isDarkTone ? "text-site-strong" : "text-site-inverse",
            sizeStyles.mark,
            markClassName,
          )}
          data-tina-field={markDataTinaField}
        >
          {mark}
        </span>

        {name ? (
          <span
            className={cn(
              "hidden font-semibold uppercase sm:inline",
              isDarkTone ? "text-site-soft" : "text-site-inverse-soft",
              sizeStyles.name,
              nameClassName,
            )}
            data-tina-field={nameDataTinaField}
          >
            {name}
          </span>
        ) : null}

        {suffix ? (
          <span
            className={cn(
              "rounded-full border font-semibold uppercase tracking-[0.16em]",
              isDarkTone
                ? "border-[color:var(--border)] bg-[var(--site-surface-1)] text-site-muted"
                : "border-white/25 bg-white/8 text-site-inverse-muted",
              sizeStyles.suffix,
              suffixClassName,
            )}
          >
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );
}
