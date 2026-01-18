import type { PropsWithChildren } from "react";

type Variant = "info" | "warning" | "error";

export function Alert(props: PropsWithChildren<{ variant?: Variant; className?: string }>) {
  const { variant = "info", className, children } = props;
  const variants: Record<Variant, string> = {
    info: "border-[rgba(31,111,139,0.35)] bg-[rgba(31,111,139,0.08)] text-[var(--ink)]",
    warning: "border-[rgba(246,174,45,0.4)] bg-[rgba(246,174,45,0.12)] text-[var(--ink)]",
    error: "border-[rgba(209,73,91,0.45)] bg-[rgba(209,73,91,0.12)] text-[var(--ink)]",
  };
  return (
    <div className={["rounded-2xl border p-3 text-sm", variants[variant], className]
      .filter(Boolean)
      .join(" ")}
    >
      {children}
    </div>
  );
}
