import type { SelectHTMLAttributes } from "react";

export function Select(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    helperText?: string;
    errorText?: string;
    options: Array<{ value: string; label: string }>;
  },
) {
  const { label, helperText, errorText, options, className, ...rest } = props;
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
        {label}
      </div>
      <select
        {...rest}
        className={[
          "w-full rounded-xl border bg-[var(--card)] px-3 py-2 text-sm outline-none transition focus:ring-2",
          errorText
            ? "border-[rgba(209,73,91,0.6)] focus:border-[var(--danger)] focus:ring-[rgba(209,73,91,0.2)]"
            : "border-[var(--stroke)] focus:border-[var(--primary)] focus:ring-[rgba(31,111,139,0.2)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errorText ? (
        <div className="mt-1 text-xs text-[var(--danger)]">{errorText}</div>
      ) : helperText ? (
        <div className="mt-1 text-xs text-[var(--muted)]">{helperText}</div>
      ) : null}
    </label>
  );
}
