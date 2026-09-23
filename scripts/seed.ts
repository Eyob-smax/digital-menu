import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";

config({ path: ".env.local" });

/**
 * Seeds a usable restaurant: the first admin account, settings, a few
 * categories with dishes, and some tables.
 *
 * Safe to re-run — it skips anything that already exists rather than
 * duplicating it.
 */
async function main() {
  // Imported lazily so dotenv has populated DATABASE_URL before db/index.ts
  // reads it at module scope.
  const { db } = await import("../db");
  const {
    categories,
    diningTables,
    menuItemOptions,
    menuItems,
    settings,
    user,
  } = await import("../db/schema");
  const { auth } = await import("../lib/auth");

  console.log("→ settings");
  await db
    .insert(settings)
    .values({
      id: 1,
      restaurantName: process.env.SEED_RESTAURANT_NAME ?? "Habesha Kitchen",
      tagline: "Traditional plates, made fresh",
      mode: "DISPLAY",
      currency: "ETB",
      taxRate: "0.15",
      serviceChargeRate: "0.10",
    })
    .onConflictDoNothing();

  /* ------------------------------------------------------------ admin */

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@restaurant.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.SEED_ADMIN_NAME ?? "Owner";

  const [existingAdmin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));

  if (existingAdmin) {
    console.log(`→ admin ${email} already exists, skipping`);
  } else {
    console.log(`→ creating admin ${email}`);

    /**
     * Public sign-up is disabled in lib/auth.ts, so `signUpEmail` would be
     * rejected here too. Create the row directly instead, but hash the
     * password with Better Auth's own hasher via its internal adapter, so the
     * credential is byte-for-byte what a normal sign-in expects — no
     * hand-rolled crypto, and no loosening the production config just to seed.
     */
    const ctx = await auth.$context;

    // `method: "admin"` is the provisioning origin Better Auth expects for an
    // account created administratively rather than by someone signing up.
    const created = await ctx.internalAdapter.createUser(
      { email, name, emailVerified: false },
      { method: "admin" },
    );

    await ctx.internalAdapter.createAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(password),
    });

    await db.update(user).set({ role: "admin" }).where(eq(user.email, email));
  }

  /* ------------------------------------------------------------- menu */

  const [{ count: categoryCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories);

  if (categoryCount > 0) {
    console.log("→ menu already seeded, skipping");
  } else {
    console.log("→ seeding menu");

    interface SeedItem {
      name: string;
      description: string;
      longDescription: string;
      price: string;
      tags: string[];
      spiceLevel: number;
      calories?: number;
      prepMinutes?: number;
      isFeatured?: boolean;
      options: {
        groupName: string;
        label: string;
        priceDelta: string;
        isDefault: boolean;
      }[];
    }

    const seedData: {
      name: string;
      description: string | null;
      items: SeedItem[];
    }[] = [
      {
        name: "Starters",
        description: "Something to begin with",
        items: [
          {
            name: "Sambusa",
            description: "Crisp pastry with spiced lentils",
            longDescription:
              "Hand-folded pastry triangles filled with lentils, onion and green chilli, fried to order and served with awaze dipping sauce.",
            price: "90.00",
            tags: ["Vegetarian"],
            spiceLevel: 1,
            prepMinutes: 10,
            options: [
              { groupName: "Filling", label: "Lentil", priceDelta: "0", isDefault: true },
              { groupName: "Filling", label: "Beef", priceDelta: "30.00", isDefault: false },
            ],
          },
          {
            name: "Timatim Salata",
            description: "Tomato, onion and jalapeño salad",
            longDescription:
              "Chopped tomato and red onion tossed with jalapeño, olive oil and lemon, scattered over injera.",
            price: "110.00",
            tags: ["Vegan", "Fresh"],
            spiceLevel: 1,
            prepMinutes: 8,
            options: [],
          },
        ],
      },
      {
        name: "Mains",
        description: "Served with injera",
        items: [
          {
            name: "Doro Wat",
            description: "Slow-cooked chicken in berbere",
            longDescription:
              "The national dish: chicken legs simmered for hours in a deep berbere and onion sauce, finished with spiced butter and a whole boiled egg.",
            price: "320.00",
            tags: ["Signature"],
            spiceLevel: 3,
            calories: 640,
            prepMinutes: 20,
            isFeatured: true,
            options: [
              { groupName: "Portion", label: "Single", priceDelta: "0", isDefault: true },
              { groupName: "Portion", label: "To share", priceDelta: "180.00", isDefault: false },
            ],
          },
          {
            name: "Key Sega Wat",
            description: "Beef stewed in berbere and butter",
            longDescription:
              "Cubed beef braised slowly with red onion, berbere and niter kibbeh until the sauce thickens and darkens.",
            price: "360.00",
            tags: ["Signature"],
            spiceLevel: 2,
            calories: 720,
            prepMinutes: 22,
            options: [],
          },
          {
            name: "Shiro",
            description: "Ground chickpea stew",
            longDescription:
              "Finely milled chickpea flour cooked with garlic, onion and a little berbere into a smooth, comforting stew.",
            price: "220.00",
            tags: ["Vegan"],
            spiceLevel: 1,
            calories: 480,
            prepMinutes: 15,
            options: [
              { groupName: "Style", label: "Classic", priceDelta: "0", isDefault: true },
              { groupName: "Style", label: "With butter", priceDelta: "40.00", isDefault: false },
            ],
          },
          {
            name: "Beyaynetu",
            description: "A platter of the day's vegetable dishes",
            longDescription:
              "A rotating selection of lentil, cabbage, beetroot and collard dishes arranged together on injera. What's on it depends on the day.",
            price: "290.00",
            tags: ["Vegan", "Sharing"],
            spiceLevel: 1,
            prepMinutes: 18,
            options: [],
          },
        ],
      },
      {
        name: "Drinks",
        description: null,
        items: [
          {
            name: "Ethiopian Coffee",
            description: "Roasted and brewed to order",
            longDescription:
              "Green beans roasted in front of you, ground and brewed in a jebena. Served in three rounds if you have the time.",
            price: "85.00",
            tags: ["Hot"],
            spiceLevel: 0,
            prepMinutes: 12,
            options: [
              { groupName: "Serve", label: "Black", priceDelta: "0", isDefault: true },
              { groupName: "Serve", label: "With milk", priceDelta: "15.00", isDefault: false },
            ],
          },
          {
            name: "Tej",
            description: "Honey wine",
            longDescription:
              "Fermented honey wine with gesho, poured from a berele. Sweet at first, dry at the finish.",
            price: "150.00",
            tags: ["Alcoholic"],
            spiceLevel: 0,
            options: [],
          },
          {
            name: "Fresh Mango Juice",
            description: "Pressed to order",
            longDescription: "Ripe mango blended thick, no added sugar.",
            price: "95.00",
            tags: ["Cold", "Vegan"],
            spiceLevel: 0,
            prepMinutes: 5,
            options: [],
          },
        ],
      },
    ];

    for (const [categoryIndex, group] of seedData.entries()) {
      const [category] = await db
        .insert(categories)
        .values({
          name: group.name,
          slug: group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: group.description,
          sortOrder: categoryIndex,
        })
        .returning({ id: categories.id });

      for (const [itemIndex, item] of group.items.entries()) {
        const [created] = await db
          .insert(menuItems)
          .values({
            categoryId: category.id,
            name: item.name,
            description: item.description,
            longDescription: item.longDescription,
            price: item.price,
            tags: item.tags,
            spiceLevel: item.spiceLevel,
            calories: item.calories ?? null,
            prepMinutes: item.prepMinutes ?? null,
            isFeatured: item.isFeatured ?? false,
            sortOrder: itemIndex,
          })
          .returning({ id: menuItems.id });

        if (item.options.length) {
          await db.insert(menuItemOptions).values(
            item.options.map((option, optionIndex) => ({
              itemId: created.id,
              groupName: option.groupName,
              label: option.label,
              priceDelta: option.priceDelta,
              isDefault: option.isDefault,
              sortOrder: optionIndex,
            })),
          );
        }
      }
    }
  }

  /* ----------------------------------------------------------- tables */

  const [{ count: tableCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(diningTables);

  if (tableCount > 0) {
    console.log("→ tables already seeded, skipping");
  } else {
    console.log("→ seeding tables");
    await db.insert(diningTables).values(
      Array.from({ length: 6 }, (_, index) => ({
        label: `Table ${index + 1}`,
        qrSlug: `table-${index + 1}`,
        seats: index < 4 ? 4 : 6,
      })),
    );
  }

  console.log("\n✓ Seed complete.");
  console.log(`  Admin sign-in: ${email}`);
  console.log(`  Password:      ${password}`);
  console.log("  Change that password before going live.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Seed failed:", error);
    process.exit(1);
  });
