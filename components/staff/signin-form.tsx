"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChefHat } from "lucide-react";

import { signIn } from "@/lib/auth-client";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Only same-origin paths are honoured, so a crafted ?next=https://… link
   * can't turn the sign-in page into an open redirect.
   */
  const nextParam = params.get("next");
  const destination =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/staff";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: authError } = await signIn.email({ email, password });

    if (authError) {
      setBusy(false);
      setError(
        authError.message ?? "That email and password didn't match an account.",
      );
      return;
    }

    router.push(destination);
    router.refresh();
  };

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <ChefHat className="mx-auto mb-3 h-9 w-9 text-accent" />
        <h1 className="font-display text-xl font-semibold text-ink">
          Staff sign in
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          For waiters and managers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Spinner className="h-4 w-4" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </Card>
  );
}
