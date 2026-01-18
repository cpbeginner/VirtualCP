import type { PropsWithChildren } from "react";

type Variant = "neutral" | "success" | "warning";

export function Badge(props: PropsWithChildren<{ variant?: Variant; className?: string }>) {
  const { variant = "neutral", className, children } = props;
  const variants: Record<Variant, string> = {
    neutral: "bg-[var(--secondary)] text-[var(--ink)]",
    success: "bg-[rgba(30,122,74,0.12)] text-[var(--success)]",
    warning: "bg-[rgba(191,122,0,0.16)] text-[var(--warning)]",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
