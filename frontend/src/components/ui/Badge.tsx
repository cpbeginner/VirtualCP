import type { PropsWithChildren } from "react";

type Variant = "neutral" | "success" | "warning";

export function Badge(props: PropsWithChildren<{ variant?: Variant; className?: string }>) {
  const { variant = "neutral", className, children } = props;
  const variants: Record<Variant, string> = {
    neutral: "bg-[var(--secondary)] text-[var(--ink)]",
    success: "bg-[rgba(27,138,90,0.14)] text-[var(--success)]",
    warning: "bg-[rgba(246,174,45,0.18)] text-[var(--warning)]",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]",
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
