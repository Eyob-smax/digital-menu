import { MenuProvider } from "@/components/menu-provider";
import { CartScreen } from "@/components/customer/cart-screen";
import { getMenuSnapshot } from "@/lib/queries";

/** Per-request: the menu and the app's mode can change at any time. */
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const snapshot = await getMenuSnapshot().catch(() => null);

  return (
    <MenuProvider
      initialSnapshot={snapshot}
    >
      <CartScreen />
    </MenuProvider>
  );
}
