import React, { createContext, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
};

type ToastInput = {
  variant?: ToastVariant;
  title: string;
  message?: string;
};

type ToastContextValue = {
  pushToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  });
  return reduced;
}

export function ToastProvider(props: React.PropsWithChildren) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const toastsRef = useRef<Toast[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function removeToast(id: string) {
    toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
    setToasts(toastsRef.current);
  }

  const value = useMemo<ToastContextValue>(() => {
    return {
      pushToast: (input) => {
        const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const toast: Toast = {
          id,
          variant: input.variant ?? "info",
          title: input.title,
          message: input.message,
        };
        toastsRef.current = [...toastsRef.current, toast].slice(-5);
        setToasts(toastsRef.current);

        window.setTimeout(() => removeToast(id), 5000);
      },
    };
  }, []);

  const motionOff =
    typeof document !== "undefined" && document.documentElement.dataset.motion === "off";
  const animationsEnabled = !prefersReducedMotion && !motionOff;

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((t) => {
          const variant: Record<ToastVariant, string> = {
            info: "border-[rgba(31,111,139,0.35)] bg-[rgba(31,111,139,0.08)]",
            success: "border-[rgba(44,157,107,0.45)] bg-[rgba(44,157,107,0.12)]",
            warning: "border-[rgba(246,174,45,0.4)] bg-[rgba(246,174,45,0.12)]",
            error: "border-[rgba(209,73,91,0.45)] bg-[rgba(209,73,91,0.12)]",
          };
          return (
            <div
              key={t.id}
              className={[
                "pointer-events-auto rounded-2xl border px-4 py-3 text-sm text-[var(--ink)] shadow-[0_14px_34px_var(--shadow)] backdrop-blur",
                variant[t.variant],
                animationsEnabled ? "vc-toast-in" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="status"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.title}</div>
                  {t.message ? (
                    <div className="mt-1 break-words text-[var(--muted)]">{t.message}</div>
                  ) : null}
                </div>
                <button
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                  onClick={() => removeToast(t.id)}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

