import { MenuProvider } from "@/components/menu-provider";
import { MenuScreen } from "@/components/customer/menu-screen";
import { getMenuSnapshot } from "@/lib/queries";

/**
 * Rendered per request, never prerendered: the menu, prices and the
 * display/ordering mode all change from the admin screen, and a statically
 * baked copy would keep serving yesterday's menu until the next deploy.
 */
export const dynamic = "force-dynamic";

/**
 * The menu. Server-rendered on a first visit so there is never a blank
 * screen, then taken over by the client provider which reads from IndexedDB
 * and syncs in the background.
 */
export default async function HomePage() {
  const snapshot = await getMenuSnapshot().catch(() => null);

  return (
    <MenuProvider
      initialSnapshot={snapshot}
    >
      <MenuScreen />
    </MenuProvider>
  );
}
