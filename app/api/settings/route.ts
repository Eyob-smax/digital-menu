import { NextResponse } from "next/server";

import { getPublicSettings } from "@/lib/queries";

/** Mode + restaurant info. Polled by the customer shell to notice a mode flip. */
export async function GET() {
  const settings = await getPublicSettings();
  return NextResponse.json(settings, {
    headers: { "cache-control": "no-store" },
  });
}
