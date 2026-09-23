"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import { saveMenuItem } from "@/app/admin/actions";
import type { AdminCategory, AdminItem } from "@/components/admin/menu-manager";
import {
  Button,
  Input,
  Label,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface DraftOption {
  key: string;
  groupName: string;
  label: string;
  priceDelta: string;
  isDefault: boolean;
}

/**
 * Add or edit one dish.
 *
 * Two description fields, deliberately: a short line for the menu card and a
 * longer one for the detail sheet. That's what the customer app renders, and
 * collapsing them into one field makes every card either too terse or too
 * long.
 */
export function ItemEditor({
  item,
  categories,
  currency,
  onClose,
}: {
  item: AdminItem | null;
  categories: AdminCategory[];
  currency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    categoryId: item?.categoryId ?? categories[0]?.id ?? "",
    name: item?.name ?? "",
    description: item?.description ?? "",
    longDescription: item?.longDescription ?? "",
    price: item?.price ?? "",
    imageUrl: item?.imageUrl ?? "",
    tags: item?.tags.join(", ") ?? "",
    spiceLevel: item?.spiceLevel ?? 0,
    calories: item?.calories?.toString() ?? "",
    prepMinutes: item?.prepMinutes?.toString() ?? "",
    isAvailable: item?.isAvailable ?? true,
    isFeatured: item?.isFeatured ?? false,
    sortOrder: item?.sortOrder ?? 0,
  });

  const [options, setOptions] = React.useState<DraftOption[]>(
    item?.options.map((option, index) => ({
      key: `${option.id}-${index}`,
      groupName: option.groupName,
      label: option.label,
      priceDelta: option.priceDelta,
      isDefault: option.isDefault,
    })) ?? [],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setBusy(true);
    setError(null);

    const result = await saveMenuItem({
      id: item?.id,
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      longDescription: form.longDescription.trim() || null,
      // Trim to two decimals so "12.999" can't slip into the price column.
      price: form.price.trim(),
      imageUrl: form.imageUrl.trim() || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8),
      spiceLevel: form.spiceLevel,
      calories: form.calories ? Number(form.calories) : null,
      prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : null,
      isAvailable: form.isAvailable,
      isFeatured: form.isFeatured,
      sortOrder: form.sortOrder,
      options: options
        .filter((option) => option.groupName.trim() && option.label.trim())
        .map((option) => ({
          groupName: option.groupName.trim(),
          label: option.label.trim(),
          priceDelta: option.priceDelta.trim() || "0",
          isDefault: option.isDefault,
        })),
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={item ? `Edit ${item.name}` : "Add a menu item"}
        className="animate-rise relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-surface-1 sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">
            {item ? "Edit item" : "New item"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              maxLength={140}
              placeholder="Doro Wat"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="item-category">Category</Label>
              <Select
                id="item-category"
                value={form.categoryId}
                onChange={(event) => update("categoryId", event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="item-price">Price ({currency})</Label>
              <Input
                id="item-price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => update("price", event.target.value)}
                placeholder="320.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="item-description">Short description</Label>
            <Input
              id="item-description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              maxLength={400}
              placeholder="Shown under the name on the menu"
            />
          </div>

          <div>
            <Label htmlFor="item-long">Full description</Label>
            <Textarea
              id="item-long"
              rows={3}
              value={form.longDescription}
              onChange={(event) => update("longDescription", event.target.value)}
              maxLength={2000}
              placeholder="Ingredients, how it's made, what it goes well with…"
            />
            <p className="mt-1 text-xs text-ink-faint">
              Shown when a customer taps the dish.
            </p>
          </div>

          <div>
            <Label htmlFor="item-image">Image URL</Label>
            <Input
              id="item-image"
              type="url"
              value={form.imageUrl}
              onChange={(event) => update("imageUrl", event.target.value)}
              placeholder="https://…"
            />
          </div>

          <div>
            <Label htmlFor="item-tags">Tags</Label>
            <Input
              id="item-tags"
              value={form.tags}
              onChange={(event) => update("tags", event.target.value)}
              placeholder="Vegetarian, Gluten-free"
            />
            <p className="mt-1 text-xs text-ink-faint">Separate with commas.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="item-spice">Spice</Label>
              <Select
                id="item-spice"
                value={form.spiceLevel}
                onChange={(event) =>
                  update("spiceLevel", Number(event.target.value))
                }
              >
                <option value={0}>None</option>
                <option value={1}>Mild</option>
                <option value={2}>Hot</option>
                <option value={3}>Very hot</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="item-prep">Prep (min)</Label>
              <Input
                id="item-prep"
                inputMode="numeric"
                value={form.prepMinutes}
                onChange={(event) => update("prepMinutes", event.target.value)}
                placeholder="15"
              />
            </div>

            <div>
              <Label htmlFor="item-cal">Calories</Label>
              <Input
                id="item-cal"
                inputMode="numeric"
                value={form.calories}
                onChange={(event) => update("calories", event.target.value)}
                placeholder="640"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Toggle
              checked={form.isAvailable}
              onChange={(value) => update("isAvailable", value)}
              label="Available"
            />
            <Toggle
              checked={form.isFeatured}
              onChange={(value) => update("isFeatured", value)}
              label="Chef's pick"
            />
          </div>

          {/* ------------------------------------------------- options */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Choices</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setOptions((current) => [
                    ...current,
                    {
                      key: `new-${Date.now()}-${current.length}`,
                      groupName: current.at(-1)?.groupName ?? "Size",
                      label: "",
                      priceDelta: "0",
                      isDefault: current.length === 0,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Add choice
              </Button>
            </div>

            {options.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-3 text-xs text-ink-faint">
                Optional. Use these for sizes, sides or extras — e.g. group
                &ldquo;Size&rdquo; with &ldquo;Small&rdquo; and
                &ldquo;Large&rdquo;.
              </p>
            ) : (
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={option.key} className="flex items-center gap-1.5">
                    <Input
                      aria-label="Group"
                      value={option.groupName}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((o, i) =>
                            i === index
                              ? { ...o, groupName: event.target.value }
                              : o,
                          ),
                        )
                      }
                      placeholder="Size"
                      className="w-[28%]"
                    />
                    <Input
                      aria-label="Choice"
                      value={option.label}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((o, i) =>
                            i === index ? { ...o, label: event.target.value } : o,
                          ),
                        )
                      }
                      placeholder="Large"
                      className="flex-1"
                    />
                    <Input
                      aria-label="Extra cost"
                      inputMode="decimal"
                      value={option.priceDelta}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((o, i) =>
                            i === index
                              ? { ...o, priceDelta: event.target.value }
                              : o,
                          ),
                        )
                      }
                      placeholder="0"
                      className="w-[22%]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      aria-label="Remove choice"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-line px-4 py-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={busy || !form.name.trim() || !form.price.trim()}
            onClick={() => void handleSave()}
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {item ? "Save changes" : "Add to menu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "min-h-[38px] rounded-full border px-3.5 text-sm transition-colors",
        checked
          ? "border-accent bg-accent/15 text-accent"
          : "border-line bg-surface-2 text-ink-muted",
      )}
    >
      {label}
    </button>
  );
}
