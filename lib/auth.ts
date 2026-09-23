import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin } from "better-auth/plugins/admin";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * Staff-only authentication. Customers never sign in — they are identified by
 * an anonymous device id. Accounts here are `admin` or `waiter`.
 *
 * Sign-up is disabled on the public surface: the first admin is created by the
 * seed script, and further staff accounts are created from /admin/staff by an
 * existing admin (the `admin` plugin's createUser endpoint).
 */
export const auth = betterAuth({
  appName: "Digital Menu",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    // Staff accounts are made by an admin, not self-service.
    disableSignUp: true,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  plugins: [
    adminPlugin({
      defaultRole: "waiter",
      adminRoles: ["admin"],
    }),
    // Must stay last: lets Server Actions set auth cookies.
    nextCookies(),
  ],

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type Session = typeof auth.$Infer.Session;
