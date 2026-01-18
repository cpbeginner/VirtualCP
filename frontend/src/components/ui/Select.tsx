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
      <div className="mb-1 text-sm font-medium text-gray-900">{label}</div>
      <select
        {...rest}
        className={[
          "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2",
          errorText
            ? "border-red-300 focus:border-red-400 focus:ring-red-200"
            : "border-gray-300 focus:border-blue-400 focus:ring-blue-200",
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
        <div className="mt-1 text-sm text-red-600">{errorText}</div>
      ) : helperText ? (
        <div className="mt-1 text-sm text-gray-500">{helperText}</div>
      ) : null}
    </label>
  );
}

