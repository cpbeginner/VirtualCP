import type { PropsWithChildren, ReactNode } from "react";

export function Card(props: PropsWithChildren<{ title?: ReactNode; className?: string }>) {
  const { title, className, children } = props;
  return (
    <div
      className={[
        "rounded-2xl border border-[var(--stroke)] bg-[var(--card)]/85 p-6 shadow-[0_18px_45px_var(--shadow)] backdrop-blur",
        className,
      ]
      .filter(Boolean)
      .join(" ")}
    >
      {title ? (
        <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}
