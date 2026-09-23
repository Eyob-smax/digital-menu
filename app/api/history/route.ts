import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { deviceLinks } from "@/db/schema";
import { getOrdersForDevice, getPersonalStats } from "@/lib/queries";

/**
 * A customer's own history: past orders plus how often they've had each dish.
 * Both are returned together because the history screen shows both and a
 * second round trip on a slow connection is a second chance to fail.
 */
export async function GET(request: Request) {
  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? "";

  if (deviceId.length < 8) {
    return NextResponse.json({ orders: [], stats: [] });
  }

  const [link] = await db
    .select({ userId: deviceLinks.userId })
    .from(deviceLinks)
    .where(eq(deviceLinks.deviceId, deviceId));

  const userId = link?.userId ?? null;

  const [orders, stats] = await Promise.all([
    getOrdersForDevice(deviceId, userId),
    getPersonalStats(deviceId, userId),
  ]);

  return NextResponse.json(
    { orders, stats },
    { headers: { "cache-control": "no-store" } },
  );
}
