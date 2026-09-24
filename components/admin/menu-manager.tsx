"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  FolderPlus,
  Pencil,
  Plus,
  X,
} from "lucide-react";

import {
  archiveMenuItem,
  deleteCategory,
  restoreMenuItem,
  saveCategory,
  setItemAvailability,
} from "@/app/admin/actions";
import { ItemEditor } from "@/components/admin/item-editor";
import { Badge, Button, Card, EmptyState, Input, Label } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface AdminItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  longDescription: string | null;
  price: string;
  imageUrl: string | null;
  tags: string[];
  spiceLevel: number;
  calories: number | null;
  prepMinutes: number | null;
  isAvailable: boolean;
  isFeatured: boolean;
  isArchived: boolean;
  sortOrder: number;
  options: {
    id: string;
    groupName: string;
    label: string;
    priceDelta: string;
    isDefault: boolean;
  }[];
}

export interface AdminCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * Menu management.
 *
 * Grouped by category with inline availability toggles, because the most
 * frequent action by far is "we've run out of that" — it should take one tap
 * and no dialog. Editing opens a full sheet; archiving is reversible.
 */
export function MenuManager({
  categories,
  items,
  currency,
}: {
  categories: AdminCategory[];
  items: AdminItem[];
  currency: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState<AdminItem | "new" | null>(null);
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = items.filter((item) => item.isArchived === showArchived);

  const grouped = categories
    .map((category) => ({
      category,
      items: visible.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0 || !showArchived);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.error) setError(result.error);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-ink">
            {showArchived ? "Removed items" : "Menu"}
          </h1>
          <Badge>{visible.length}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived((s) => !s)}
          >
            {showArchived ? "Back to menu" : "Removed items"}
          </Button>

          {!showArchived && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAddingCategory((a) => !a)}
              >
                <FolderPlus className="h-4 w-4" />
                Category
              </Button>
              <Button
                size="sm"
                onClick={() => setEditing("new")}
                disabled={categories.length === 0}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {/* ------------------------------------------------- new category */}
      {addingCategory && (
        <Card className="animate-rise p-3.5">
          <Label htmlFor="new-category">New category</Label>
          <div className="flex gap-2">
            <Input
              id="new-category"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Starters, Mains, Drinks…"
              maxLength={80}
            />
            <Button
              disabled={!categoryName.trim() || pending}
              onClick={() => {
                const name = categoryName.trim();
                if (!name) return;
                run(async () => {
                  const result = await saveCategory({
                    name,
                    sortOrder: categories.length,
                  });
                  if (result.ok) {
                    setCategoryName("");
                    setAddingCategory(false);
                  }
                  return result;
                });
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="h-10 w-10" />}
          title="Start with a category"
          hint="Menu items live inside categories like Starters or Drinks."
          action={
            <Button onClick={() => setAddingCategory(true)}>
              Add a category
            </Button>
          }
        />
      ) : (
        grouped.map(({ category, items: categoryItems }) => (
          <section key={category.id}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-display font-semibold text-ink">
                {category.name}
              </h2>
              <span className="text-sm text-ink-faint">
                {categoryItems.length}
              </span>

              {!showArchived && categoryItems.length === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      const result = await deleteCategory(category.id);
                      return result;
                    })
                  }
                  disabled={pending}
                  className="ml-auto text-xs text-ink-faint hover:text-danger"
                >
                  Remove category
                </button>
              )}
            </div>

            {categoryItems.length === 0 ? (
              <Card className="px-3.5 py-4 text-sm text-ink-faint">
                Nothing here yet.
              </Card>
            ) : (
              <Card className="divide-y divide-[var(--color-line)]">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      !item.isAvailable && !item.isArchived && "opacity-60",
                    )}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-faint">
                        {item.name.slice(0, 1)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-medium text-ink">
                          {item.name}
                        </p>
                        {item.isFeatured && <Badge tone="accent">Featured</Badge>}
                        {item.options.length > 0 && (
                          <Badge>{item.options.length} options</Badge>
                        )}
                      </div>
                      <p className="text-sm text-ink-muted tabular-nums">
                        {formatMoney(item.price, currency)}
                      </p>
                    </div>

                    {showArchived ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => restoreMenuItem(item.id))
                        }
                      >
                        <ArchiveRestore className="h-4 w-4" />
                        Restore
                      </Button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        {/* One-tap sold-out toggle: the most common action. */}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              setItemAvailability(item.id, !item.isAvailable),
                            )
                          }
                          aria-pressed={item.isAvailable}
                          aria-label={
                            item.isAvailable
                              ? `Mark ${item.name} sold out`
                              : `Mark ${item.name} available`
                          }
                          className={cn(
                            "flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                            item.isAvailable
                              ? "bg-success/12 text-success"
                              : "bg-danger/12 text-danger",
                          )}
                        >
                          {item.isAvailable ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              On
                            </>
                          ) : (
                            <>
                              <X className="h-3.5 w-3.5" />
                              Off
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          aria-label={`Edit ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => archiveMenuItem(item.id))}
                          aria-label={`Remove ${item.name} from the menu`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-danger"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </section>
        ))
      )}

      {showArchived && visible.length === 0 && (
        <EmptyState
          icon={<Archive className="h-10 w-10" />}
          title="Nothing removed"
          hint="Items you remove are kept here so past orders and stats stay intact."
        />
      )}

      {editing && (
        <ItemEditor
          item={editing === "new" ? null : editing}
          categories={categories}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
