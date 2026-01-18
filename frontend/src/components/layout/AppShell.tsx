import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiLogout, apiMe } from "../../api/auth";
import { Button } from "../ui/Button";

function linkClassName(isActive: boolean) {
  return [
    "rounded-md px-3 py-2 text-sm font-medium",
    isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:text-gray-900",
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
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold text-gray-900">VirtualCP</div>
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
            <div className="text-sm text-gray-700">{me.data?.username}</div>
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
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
