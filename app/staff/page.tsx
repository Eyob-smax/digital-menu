import { StaffScreen } from "@/components/staff/staff-screen";
import { requireStaff } from "@/lib/guard";
import { getLiveOrders, getPublicSettings } from "@/lib/queries";

/** Live order queue. Waiters and admins both land here. */
export default async function StaffPage() {
  await requireStaff();

  const [orders, settings] = await Promise.all([
    getLiveOrders(),
    getPublicSettings(),
  ]);

  return <StaffScreen initialOrders={orders} currency={settings.currency} />;
}
