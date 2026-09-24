import { Suspense } from "react";

import { SignInForm } from "@/components/staff/signin-form";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Staff sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto w-full flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
