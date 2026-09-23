/**
 * Money handling.
 *
 * Every amount is a decimal string ("320.00") at rest and in transit, and is
 * converted to integer cents for arithmetic. Floats are never used: 0.1 + 0.2
 * is not 0.3, and a menu that quietly loses a cent per line is a bug that only
 * shows up in the till at closing time.
 */

/** "320.5" -> 32050 */
export function toCents(amount: string | number): number {
  const value = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  if (!value) return 0;

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");

  const cents =
    Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));

  if (!Number.isFinite(cents)) return 0;
  return negative ? -cents : cents;
}

/** 32050 -> "320.50" */
export function fromCents(cents: number): string {
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const out = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${out}` : out;
}

export function addMoney(...amounts: (string | number)[]): string {
  return fromCents(amounts.reduce<number>((sum, a) => sum + toCents(a), 0));
}

export function multiplyMoney(amount: string | number, qty: number): string {
  return fromCents(toCents(amount) * qty);
}

/**
 * Applies a rate like "0.15". Rounds half-up at the last cent, which is what
 * a customer expects to see on a printed bill.
 */
export function applyRate(amount: string | number, rate: string): string {
  const parsed = Number(rate);
  if (!Number.isFinite(parsed) || parsed <= 0) return "0.00";
  return fromCents(Math.round(toCents(amount) * parsed));
}

/** Base price plus every selected option's delta. */
export function unitPriceWithOptions(
  basePrice: string,
  options: { priceDelta: string }[],
): string {
  return fromCents(
    options.reduce<number>(
      (sum, option) => sum + toCents(option.priceDelta),
      toCents(basePrice),
    ),
  );
}

/**
 * Formats for display. Currencies like ETB have no standard symbol in most
 * locales, so the code is shown after the number: "320.50 ETB".
 */
export function formatMoney(amount: string | number, currency = "ETB"): string {
  const cents = toCents(amount);
  const negative = cents < 0;
  const abs = Math.abs(cents);

  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${negative ? "-" : ""}${grouped}.${fraction} ${currency}`;
}

/** Order maths in one place, so the client preview and the server agree. */
export function computeTotals(
  lines: { unitPrice: string; qty: number }[],
  taxRate: string,
  serviceChargeRate: string,
) {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + toCents(line.unitPrice) * line.qty,
    0,
  );
  const subtotal = fromCents(subtotalCents);
  const tax = applyRate(subtotal, taxRate);
  const serviceCharge = applyRate(subtotal, serviceChargeRate);

  return {
    subtotal,
    tax,
    serviceCharge,
    total: addMoney(subtotal, tax, serviceCharge),
  };
}
