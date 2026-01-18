import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { apiLogin } from "../api/auth";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

export function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: apiLogin,
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      navigate("/dashboard", { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Login failed");
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md">
        <Card title="Sign in">
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
              login.mutate({ username, password });
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" className="w-full" isLoading={login.isPending}>
              Sign in
            </Button>
          </form>
          <div className="mt-4 text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link className="text-blue-600 hover:underline" to="/register">
              Register
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

