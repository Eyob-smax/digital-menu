"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { updateSettings } from "@/app/admin/actions";
import { ModeSwitch } from "@/components/admin/mode-switch";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { PublicSettings } from "@/lib/types";

/**
 * Restaurant settings.
 *
 * Tax and service charge are entered as percentages because that is how
 * people think about them, and stored as rates ("0.15"), which is how the
 * money helpers apply them.
 */
export function SettingsForm({ settings }: { settings: PublicSettings }) {
  const router = useRouter();

  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    restaurantName: settings.restaurantName,
    tagline: settings.tagline ?? "",
    currency: settings.currency,
    taxPercent: (Number(settings.taxRate) * 100).toString(),
    servicePercent: (Number(settings.serviceChargeRate) * 100).toString(),
  });

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);

    const taxPercent = Number(form.taxPercent);
    const servicePercent = Number(form.servicePercent);

    if (
      !Number.isFinite(taxPercent) ||
      !Number.isFinite(servicePercent) ||
      taxPercent < 0 ||
      taxPercent > 100 ||
      servicePercent < 0 ||
      servicePercent > 100
    ) {
      setBusy(false);
      setError("Tax and service must be between 0 and 100 percent.");
      return;
    }

    const result = await updateSettings({
      restaurantName: form.restaurantName.trim(),
      tagline: form.tagline.trim() || null,
      currency: form.currency.trim(),
      taxRate: taxPercent / 100,
      serviceChargeRate: servicePercent / 100,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  // Live preview of what a 100-unit order becomes, so a mistyped rate is
  // obvious before it reaches a customer's bill.
  const sample = React.useMemo(() => {
    const tax = (100 * Number(form.taxPercent || 0)) / 100;
    const service = (100 * Number(form.servicePercent || 0)) / 100;
    return 100 + tax + service;
  }, [form.taxPercent, form.servicePercent]);

  return (
    <div className="space-y-7">
      <ModeSwitch
        mode={settings.mode}
        acceptingOrders={settings.acceptingOrders}
      />

      <section>
        <h2 className="font-display mb-2.5 text-lg font-semibold text-ink">
          Restaurant details
        </h2>

        <Card className="space-y-4 p-4">
          <div>
            <Label htmlFor="restaurant-name">Name</Label>
            <Input
              id="restaurant-name"
              value={form.restaurantName}
              onChange={(event) => update("restaurantName", event.target.value)}
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(event) => update("tagline", event.target.value)}
              maxLength={200}
              placeholder="Shown under the name on the menu"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency}
                onChange={(event) => update("currency", event.target.value)}
                maxLength={8}
                placeholder="ETB"
              />
            </div>

            <div>
              <Label htmlFor="tax">Tax %</Label>
              <Input
                id="tax"
                inputMode="decimal"
                value={form.taxPercent}
                onChange={(event) => update("taxPercent", event.target.value)}
                placeholder="15"
              />
            </div>

            <div>
              <Label htmlFor="service">Service %</Label>
              <Input
                id="service"
                inputMode="decimal"
                value={form.servicePercent}
                onChange={(event) =>
                  update("servicePercent", event.target.value)
                }
                placeholder="10"
              />
            </div>
          </div>

          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-ink-muted">
            A {formatMoney("100", form.currency || "ETB")} order would total{" "}
            <span className="font-semibold text-ink">
              {formatMoney(sample.toFixed(2), form.currency || "ETB")}
            </span>
            .
          </p>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button disabled={busy} onClick={() => void handleSave()}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Save changes
            </Button>

            {saved && (
              <span className="animate-fade flex items-center gap-1.5 text-sm text-success">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
