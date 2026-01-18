import type { PropsWithChildren } from "react";

type Variant = "info" | "warning" | "error";

export function Alert(props: PropsWithChildren<{ variant?: Variant; className?: string }>) {
  const { variant = "info", className, children } = props;
  const variants: Record<Variant, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={["rounded-md border p-3 text-sm", variants[variant], className]
      .filter(Boolean)
      .join(" ")}
    >
      {children}
    </div>
  );
}

