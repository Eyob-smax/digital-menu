import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { menuItemOptions, menuItems } from "@/db/schema";
import { MenuManager, type AdminItem } from "@/components/admin/menu-manager";
import { getAdminCategories, getPublicSettings } from "@/lib/queries";
import { requireAdmin } from "@/lib/guard";

/**
 * Menu management reads *everything*, archived items included, because this
 * screen is where removed items are restored from.
 */
export default async function AdminMenuPage() {
  await requireAdmin();

  const [categories, settings, itemRows] = await Promise.all([
    getAdminCategories(),
    getPublicSettings(),
    db.select().from(menuItems).orderBy(menuItems.sortOrder, menuItems.name),
  ]);

  const ids = itemRows.map((item) => item.id);
  const optionRows = ids.length
    ? await db
        .select()
        .from(menuItemOptions)
        .where(inArray(menuItemOptions.itemId, ids))
        .orderBy(menuItemOptions.groupName, menuItemOptions.sortOrder)
    : [];

  const optionsByItem = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const list = optionsByItem.get(option.itemId) ?? [];
    list.push(option);
    optionsByItem.set(option.itemId, list);
  }

  const items: AdminItem[] = itemRows.map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    longDescription: item.longDescription,
    price: item.price,
    imageUrl: item.imageUrl,
    tags: item.tags,
    spiceLevel: item.spiceLevel,
    calories: item.calories,
    prepMinutes: item.prepMinutes,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    isArchived: item.isArchived,
    sortOrder: item.sortOrder,
    options: (optionsByItem.get(item.id) ?? []).map((option) => ({
      id: option.id,
      groupName: option.groupName,
      label: option.label,
      priceDelta: option.priceDelta,
      isDefault: option.isDefault,
    })),
  }));

  return (
    <MenuManager
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      }))}
      items={items}
      currency={settings.currency}
    />
  );
}
