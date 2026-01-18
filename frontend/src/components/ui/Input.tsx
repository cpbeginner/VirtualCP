import type { InputHTMLAttributes } from "react";

export function Input(
  props: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    helperText?: string;
    errorText?: string;
  },
) {
  const { label, helperText, errorText, className, ...rest } = props;
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-gray-900">{label}</div>
      <input
        {...rest}
        className={[
          "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2",
          errorText
            ? "border-red-300 focus:border-red-400 focus:ring-red-200"
            : "border-gray-300 focus:border-blue-400 focus:ring-blue-200",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {errorText ? (
        <div className="mt-1 text-sm text-red-600">{errorText}</div>
      ) : helperText ? (
        <div className="mt-1 text-sm text-gray-500">{helperText}</div>
      ) : null}
    </label>
  );
}

