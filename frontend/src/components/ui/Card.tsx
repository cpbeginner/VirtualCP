import type { PropsWithChildren, ReactNode } from "react";

export function Card(props: PropsWithChildren<{ title?: ReactNode; className?: string }>) {
  const { title, className, children } = props;
  return (
    <div className={["rounded-lg border border-gray-200 bg-white p-6 shadow-sm", className]
      .filter(Boolean)
      .join(" ")}
    >
      {title ? <div className="mb-4 text-lg font-semibold">{title}</div> : null}
      {children}
    </div>
  );
}

