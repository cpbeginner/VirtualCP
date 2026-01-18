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
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold tracking-[0.12em] uppercase transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--primary)] text-[var(--primary-ink)] shadow-[0_16px_32px_rgba(31,111,139,0.28)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(31,111,139,0.35)] focus:ring-[rgba(31,111,139,0.25)]",
    secondary:
      "bg-[var(--secondary)] text-[var(--ink)] shadow-[0_12px_28px_rgba(75,90,96,0.15)] hover:-translate-y-0.5 focus:ring-[rgba(75,90,96,0.18)]",
    danger:
      "bg-[var(--danger)] text-white shadow-[0_12px_28px_rgba(209,73,91,0.3)] hover:-translate-y-0.5 focus:ring-[rgba(209,73,91,0.25)]",
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
