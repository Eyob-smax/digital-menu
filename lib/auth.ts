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
/**
 * The public URL, when one is configured. On a real deployment this must be
 * the https:// address customers and staff use.
 */
const configuredURL = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") || null;

/**
 * Secure cookies only when the app is actually served over https.
 *
 * Tying this to NODE_ENV instead broke sign-in on `next start` over plain
 * http on a LAN address: browsers silently discard a Secure cookie there
 * (they only exempt localhost), so login returned 200 and then bounced
 * straight back to the sign-in page. Staff testing on phones over the
 * restaurant wifi hit exactly that.
 */
const useSecureCookies = configuredURL?.startsWith("https://") ?? false;

/**
 * Hosts that are only reachable from this machine or the local network:
 * localhost, loopback, the private IPv4 ranges, and mDNS `.local` names.
 */
function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) {
    return true;
  }
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n))) {
    return false;
  }
  const [a, b] = octets;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

/**
 * Which origins may make authenticated requests (Better Auth's CSRF check).
 *
 * This was the cause of "the admin password doesn't work": BETTER_AUTH_URL
 * said localhost:3000, but port 3000 was taken by another app, so Next moved
 * this one to 3001 and every sign-in was rejected as "Invalid origin" before
 * the password was even looked at.
 *
 * The fix trusts the origin the request was actually sent to, which is the
 * definition of same-origin: a page on evil.example posting to
 * 192.168.1.5:3001 still sends Origin: evil.example and is still rejected.
 * That extra trust is limited to local/private-network hosts, so a public
 * deployment remains pinned strictly to BETTER_AUTH_URL.
 */
async function trustedOrigins(request?: Request): Promise<string[]> {
  const origins = new Set<string>();
  if (configuredURL) origins.add(new URL(configuredURL).origin);

  if (request) {
    try {
      // The Host header, not request.url: Next builds request.url from its
      // own listening address (localhost), so a phone on 192.168.1.50 would
      // otherwise be compared against the wrong origin. A browser sets Host
      // to the address it actually loaded, and a cross-site page cannot
      // change it — it is a forbidden request header.
      const host = request.headers.get("host");
      if (host) {
        const protocol = new URL(request.url).protocol;
        const self = new URL(`${protocol}//${host}`);
        if (isLocalNetworkHost(self.hostname)) origins.add(self.origin);
      }
    } catch {
      // A malformed host just means no extra origin is trusted.
    }
  }

  return [...origins];
}

export const auth = betterAuth({
  appName: "Digital Menu",

  trustedOrigins,

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
    useSecureCookies,
  },
});

export type Session = typeof auth.$Infer.Session;
