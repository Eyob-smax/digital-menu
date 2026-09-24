"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChefHat } from "lucide-react";

import { signIn } from "@/lib/auth-client";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

/**
 * Turns Better Auth's error into something staff can act on. Showing the raw
 * message made a server misconfiguration ("Invalid origin") look exactly like
 * a wrong password, which is how that bug hid.
 */
function describeAuthError(error: {
  code?: string;
  status?: number;
  message?: string;
}): string {
  if (error.status === 429) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password didn't match an account.";
    case "INVALID_ORIGIN":
      return "The server didn't accept sign-ins from this address. Check that BETTER_AUTH_URL matches the address in your browser.";
    case "BANNED_USER":
      return "This account has been disabled. Ask an admin to restore it.";
  }
  return error.message || "Couldn't sign in. Check your connection and try again.";
}

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
      setError(describeAuthError(authError));
      return;
    }

    router.push(destination);
    router.refresh();
  };

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <ChefHat className="mx-auto mb-3 h-9 w-9 text-accent-text" />
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
