import type { PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { apiMe } from "../../api/auth";

export function ProtectedRoute(props: PropsWithChildren) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: apiMe,
    retry: false,
  });

  if (me.isLoading) {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  if (me.isError) {
    return <Navigate to="/login" replace />;
  }

  return <>{props.children}</>;
}

