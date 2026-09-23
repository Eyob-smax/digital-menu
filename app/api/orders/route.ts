import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { deviceLinks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { placeOrder } from "@/lib/orders";
import { getLiveOrders } from "@/lib/queries";

const draftSchema = z.object({
  clientId: z.string().uuid(),
  deviceId: z.string().min(8).max(64),
  tableSlug: z.string().max(40).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().int().min(1).max(99),
        selectedOptions: z
          .array(
            z.object({
              groupName: z.string().max(60),
              label: z.string().max(80),
              // Accepted but ignored: the server re-reads the real delta.
              priceDelta: z.string().max(20).optional(),
            }),
          )
          .max(20)
          .default([]),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Customers place orders here. No session required — this is the anonymous
 * path — so the payload is treated as untrusted: quantities are clamped and
 * every price is recomputed server-side in `placeOrder`.
 */
export async function POST(request: Request) {
  const parsed = draftSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "That order didn't look right.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const draft = parsed.data;

  const [link] = await db
    .select({ userId: deviceLinks.userId })
    .from(deviceLinks)
    .where(eq(deviceLinks.deviceId, draft.deviceId));

  const result = await placeOrder(
    {
      clientId: draft.clientId,
      deviceId: draft.deviceId,
      tableSlug: draft.tableSlug ?? null,
      note: draft.note ?? null,
      lines: draft.lines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        selectedOptions: (line.selectedOptions ?? []).map((o) => ({
          groupName: o.groupName,
          label: o.label,
          priceDelta: o.priceDelta ?? "0",
        })),
        note: line.note,
      })),
    },
    { source: "CUSTOMER", userId: link?.userId ?? null },
  );

  if (!result.ok) {
    // 409 for "the menu moved under you", which the sync layer treats as
    // settled rather than retrying forever.
    const status = result.code === "UNAVAILABLE" || result.code === "CLOSED" ? 409 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    publicCode: result.publicCode,
    duplicate: result.duplicate,
  });
}

/** The staff queue. Polled every few seconds by /staff. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const orders = await getLiveOrders();

  return NextResponse.json(
    { orders, serverTime: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
