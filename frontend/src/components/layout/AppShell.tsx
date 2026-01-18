import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiLogout, apiMe } from "../../api/auth";
import { Button } from "../ui/Button";

function linkClassName(isActive: boolean) {
  return [
    "rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] transition",
    isActive
      ? "bg-[var(--secondary)] text-[var(--ink)] shadow-[0_10px_24px_rgba(15,27,31,0.08)]"
      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[rgba(31,111,139,0.08)]",
  ].join(" ");
}

export function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: apiMe,
    retry: false,
  });

  const logout = useMutation({
    mutationFn: apiLogout,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate("/login", { replace: true });
    },
  });

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-8">
        <aside className="hidden w-64 flex-shrink-0 flex-col gap-6 rounded-3xl border border-[var(--stroke)] bg-[var(--card)]/90 p-6 shadow-[0_20px_50px_var(--shadow)] backdrop-blur md:flex">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              VirtualCP
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Virtual arena
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive)}>
              Dashboard
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => linkClassName(isActive)}>
              Settings
            </NavLink>
          </nav>
          <div className="mt-auto space-y-3">
            <div className="rounded-2xl border border-[var(--stroke)] bg-[rgba(31,111,139,0.08)] p-4 text-sm text-[var(--muted)]">
              Signed in as
              <div className="mt-1 text-base font-semibold text-[var(--ink)]">
                {me.data?.username ?? "--"}
              </div>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => logout.mutate()}
              isLoading={logout.isPending}
            >
              Logout
            </Button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--stroke)] bg-[var(--card)]/80 px-5 py-4 shadow-[0_12px_28px_var(--shadow)] backdrop-blur md:hidden">
            <div className="text-lg font-semibold font-display">VirtualCP</div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-[var(--muted)]">{me.data?.username}</div>
              <Button
                variant="secondary"
                onClick={() => logout.mutate()}
                isLoading={logout.isPending}
              >
                Logout
              </Button>
            </div>
          </div>
          <main className="page-enter min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
