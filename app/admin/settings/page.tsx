import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/guard";
import { getPublicSettings } from "@/lib/queries";

export default async function SettingsPage() {
  await requireAdmin();

  const settings = await getPublicSettings();

  return <SettingsForm settings={settings} />;
}
