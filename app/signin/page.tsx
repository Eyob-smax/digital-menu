import { Suspense } from "react";

import { SignInForm } from "@/components/staff/signin-form";
import { Skeleton } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Staff sign in" };

export default function SignInPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <ThemeToggle className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4" />
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
