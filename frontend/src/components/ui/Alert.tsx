import type { PropsWithChildren } from "react";

type Variant = "info" | "warning" | "error";

export function Alert(props: PropsWithChildren<{ variant?: Variant; className?: string }>) {
  const { variant = "info", className, children } = props;
  const variants: Record<Variant, string> = {
    info: "border-[rgba(10,107,90,0.3)] bg-[rgba(10,107,90,0.08)] text-[var(--ink)]",
    warning: "border-[rgba(191,122,0,0.4)] bg-[rgba(191,122,0,0.1)] text-[var(--ink)]",
    error: "border-[rgba(214,74,58,0.4)] bg-[rgba(214,74,58,0.1)] text-[var(--ink)]",
  };
  return (
    <div className={["rounded-xl border p-3 text-sm", variants[variant], className]
      .filter(Boolean)
      .join(" ")}
    >
      {children}
    </div>
  );
}
