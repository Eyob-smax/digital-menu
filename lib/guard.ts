import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";

/**
 * The real authorization boundary.
 *
 * proxy.ts only checks that a session cookie exists, which is an optimistic
 * filter for redirecting signed-out visitors. These helpers verify the
 * session against the database on the server, and every protected page and
 * route handler calls one of them.
 */

export async function requireStaff() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/signin");

  return session;
}

export async function requireAdmin() {
  const session = await requireStaff();

  if (session.user.role !== "admin") {
    // A waiter who wanders into /admin is sent to the screen they do own,
    // rather than a dead end.
    redirect("/staff");
  }

  return session;
}

export async function getOptionalSession() {
  return auth.api.getSession({ headers: await headers() });
}
