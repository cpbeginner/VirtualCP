import type { PropsWithChildren } from "react";

type Variant = "neutral" | "success" | "warning";

export function Badge(props: PropsWithChildren<{ variant?: Variant; className?: string }>) {
  const { variant = "neutral", className, children } = props;
  const variants: Record<Variant, string> = {
    neutral: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
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

