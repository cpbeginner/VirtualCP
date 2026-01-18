import type { PropsWithChildren, ReactNode } from "react";

export function Table(
  props: PropsWithChildren<{ headers: ReactNode[]; className?: string }>,
) {
  const { headers, children, className } = props;
  return (
    <div className={["overflow-x-auto rounded-md border border-gray-200", className]
      .filter(Boolean)
      .join(" ")}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

