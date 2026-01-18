import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "danger";

export function Button(
  props: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: Variant;
      isLoading?: boolean;
    }
  >,
) {
  const { variant = "primary", isLoading, disabled, children, className, ...rest } = props;
  const isDisabled = disabled || isLoading;

  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold tracking-tight transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--primary)] text-[var(--primary-ink)] shadow-[0_10px_24px_rgba(10,107,90,0.25)] hover:-translate-y-0.5 focus:ring-[rgba(10,107,90,0.25)]",
    secondary:
      "bg-[var(--secondary)] text-[var(--ink)] shadow-[0_10px_24px_rgba(142,110,67,0.18)] hover:-translate-y-0.5 focus:ring-[rgba(142,110,67,0.2)]",
    danger:
      "bg-[var(--danger)] text-white shadow-[0_10px_24px_rgba(214,74,58,0.25)] hover:-translate-y-0.5 focus:ring-[rgba(214,74,58,0.25)]",
  };

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[base, variants[variant], className].filter(Boolean).join(" ")}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
}
