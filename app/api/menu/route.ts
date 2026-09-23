import { NextResponse } from "next/server";

import { getMenuSnapshot } from "@/lib/queries";

/**
 * The customer app's single data endpoint.
 *
 * `?since=<version>` lets a client with a warm cache ask "anything new?" and
 * get a 30-byte answer instead of the whole menu. That keeps the app cheap to
 * open on a phone with one bar of signal.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? "0");

  const snapshot = await getMenuSnapshot();

  if (Number.isFinite(since) && since > 0 && since === snapshot.version) {
    return NextResponse.json(
      { unchanged: true, version: snapshot.version },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(snapshot, {
    headers: { "cache-control": "no-store" },
  });
}
