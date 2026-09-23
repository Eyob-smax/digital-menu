import { headers } from "next/headers";

import { TablesManager } from "@/components/admin/tables-manager";
import { requireAdmin } from "@/lib/guard";
import { getTables } from "@/lib/queries";

export default async function TablesPage() {
  await requireAdmin();

  const [tables, headerList] = await Promise.all([getTables(), headers()]);

  // Build the QR target from the request, so codes work on whatever host the
  // app is actually deployed to without extra configuration.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : "";

  return (
    <TablesManager
      tables={tables.map((table) => ({
        id: table.id,
        label: table.label,
        qrSlug: table.qrSlug,
        seats: table.seats,
        isActive: table.isActive,
      }))}
      baseUrl={baseUrl}
    />
  );
}
