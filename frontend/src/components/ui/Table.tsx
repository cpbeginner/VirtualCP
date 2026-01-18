import type { PropsWithChildren, ReactNode } from "react";

export function Table(
  props: PropsWithChildren<{ headers: ReactNode[]; className?: string }>,
) {
  const { headers, children, className } = props;
  return (
    <div
      className={[
        "overflow-x-auto rounded-2xl border border-[var(--stroke)] bg-[var(--card)]/85 shadow-[0_18px_45px_var(--shadow)] backdrop-blur",
        className,
      ]
      .filter(Boolean)
      .join(" ")}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-[rgba(255,255,255,0.6)] text-[var(--muted)]">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--stroke)] bg-transparent">{children}</tbody>
      </table>
    </div>
  );
}
