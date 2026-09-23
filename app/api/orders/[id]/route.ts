import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { updateOrderStatus } from "@/lib/orders";

const patchSchema = z.object({
  status: z.enum(["PREPARING", "READY", "SERVED", "CANCELLED"]),
});

/**
 * Staff advance an order through its lifecycle here. Legal transitions are
 * enforced in `updateOrderStatus`, so a double-tap or a stale screen cannot
 * move an order backwards.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/orders/[id]">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const result = await updateOrderStatus(id, parsed.data.status);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
