import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { deviceLinks, favorites } from "@/db/schema";
import { getFavoriteIds } from "@/lib/queries";

/**
 * Favorites are keyed by anonymous device id. There is no session to check —
 * the device id *is* the identity — so the only thing worth validating is
 * that it looks like an id we issued.
 */

const bodySchema = z.object({
  deviceId: z.string().min(8).max(64),
  itemId: z.string().uuid(),
});

async function linkedUserId(deviceId: string): Promise<string | null> {
  const [link] = await db
    .select({ userId: deviceLinks.userId })
    .from(deviceLinks)
    .where(eq(deviceLinks.deviceId, deviceId));
  return link?.userId ?? null;
}

export async function GET(request: Request) {
  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? "";
  if (deviceId.length < 8) {
    return NextResponse.json({ itemIds: [] });
  }

  const userId = await linkedUserId(deviceId);
  const itemIds = await getFavoriteIds(deviceId, userId);

  return NextResponse.json(
    { itemIds },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { deviceId, itemId } = parsed.data;
  const userId = await linkedUserId(deviceId);

  // Idempotent: favoriting twice (a retried offline toggle) is a no-op.
  await db
    .insert(favorites)
    .values({ deviceId, itemId, userId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { deviceId, itemId } = parsed.data;

  await db
    .delete(favorites)
    .where(and(eq(favorites.deviceId, deviceId), eq(favorites.itemId, itemId)));

  return NextResponse.json({ ok: true });
}
