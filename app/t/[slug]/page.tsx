import { notFound } from "next/navigation";

import { TableBinder } from "@/components/customer/table-binder";
import { getTableBySlug } from "@/lib/queries";

/**
 * QR entry point. Scanning the code on table 7 lands here, which records the
 * table on the device and forwards to the menu — so an order placed later
 * already knows where to deliver it.
 */
export default async function TablePage({
  params,
}: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const table = await getTableBySlug(slug).catch(() => null);

  if (!table) notFound();

  return <TableBinder slug={slug} label={table.label} />;
}
