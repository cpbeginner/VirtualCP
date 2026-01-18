import type { PropsWithChildren, ReactNode } from "react";

export function Table(
  props: PropsWithChildren<{ headers: ReactNode[]; className?: string }>,
) {
  const { headers, children, className } = props;
  return (
    <div
      className={[
        "overflow-x-auto rounded-2xl border border-[var(--stroke)] bg-[var(--card)]/92 shadow-[0_16px_38px_var(--shadow)] backdrop-blur",
        className,
      ]
      .filter(Boolean)
      .join(" ")}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-[rgba(255,255,255,0.7)] text-[var(--muted)]">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.28em]"
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
