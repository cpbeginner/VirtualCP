import type { PropsWithChildren, ReactNode } from "react";

export function Card(props: PropsWithChildren<{ title?: ReactNode; className?: string }>) {
  const { title, className, children } = props;
  return (
    <div
      className={[
        "rounded-2xl border border-[var(--stroke)] bg-[var(--card)]/92 p-6 shadow-[0_16px_40px_var(--shadow)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(15,27,31,0.16)]",
        className,
      ]
      .filter(Boolean)
      .join(" ")}
    >
      {title ? (
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}
