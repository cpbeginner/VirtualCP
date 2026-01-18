import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRegister } from "../api/auth";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

export function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cfHandle, setCfHandle] = useState("");
  const [atcoderUser, setAtcoderUser] = useState("");
  const [error, setError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: apiRegister,
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      navigate("/dashboard", { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Card title="Create account" className="relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[rgba(10,107,90,0.12)] blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[rgba(191,122,0,0.16)] blur-2xl" />
          <div className="relative">
            <div className="mb-3 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Create your arena
            </div>
            {error ? (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              register.mutate({
                username,
                password,
                cfHandle: cfHandle.trim() ? cfHandle.trim() : undefined,
                atcoderUser: atcoderUser.trim() ? atcoderUser.trim() : undefined,
              });
            }}
          >
            <Input
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Codeforces handle (optional)"
              value={cfHandle}
              onChange={(e) => setCfHandle(e.target.value)}
            />
            <Input
              label="AtCoder user id (optional)"
              value={atcoderUser}
              onChange={(e) => setAtcoderUser(e.target.value)}
            />
            <Button type="submit" className="w-full" isLoading={register.isPending}>
              Create account
            </Button>
          </form>
          <div className="mt-4 text-sm text-[var(--muted)]">
            Already have an account?{" "}
            <Link className="font-semibold text-[var(--primary)] hover:underline" to="/login">
              Sign in
            </Link>
          </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
