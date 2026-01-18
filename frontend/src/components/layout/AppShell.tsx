import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiLogout, apiMe } from "../../api/auth";
import { Button } from "../ui/Button";

function linkClassName(isActive: boolean) {
  return [
    "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
    isActive
      ? "bg-[var(--secondary)] text-[var(--ink)]"
      : "text-[var(--muted)] hover:text-[var(--ink)]",
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
      <div className="sticky top-0 z-10 border-b border-[rgba(231,218,203,0.8)] bg-[rgba(255,255,255,0.75)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="text-xl font-semibold tracking-tight text-[var(--ink)] font-display">
              VirtualCP
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive)}>
                Dashboard
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => linkClassName(isActive)}>
                Settings
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
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
      </div>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
