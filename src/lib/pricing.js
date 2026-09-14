// Centralized pricing engine. Every screen that shows a total (POS, Billing,
// receipts, reports) must compute through here — never re-derive totals
// inline in a component. All math happens in integer paisa to avoid
// floating-point drift, then is converted back to rupees for display.

export const toPaisa = (rupees) => Math.round((Number(rupees) || 0) * 100);
export const toRupees = (paisa) => paisa / 100;

export function formatMoney(rupees) {
  const n = Math.round(Number(rupees) || 0);
  return `Rs. ${n.toLocaleString('en-PK')}`;
}

/**
 * lines: [{ price, qty }]
 * discountAmount: flat rupee discount applied to the subtotal
 * taxRate / serviceChargeRate: percentages applied to the post-discount amount
 */
export function computeOrderTotals({ lines = [], discountAmount = 0, taxRate = 0, serviceChargeRate = 0 }) {
  const subtotalP = lines.reduce((sum, l) => sum + toPaisa(l.price) * l.qty, 0);
  const discountP = Math.min(toPaisa(discountAmount), subtotalP);
  const taxableP = subtotalP - discountP;
  const taxP = Math.round(taxableP * (Number(taxRate) || 0) / 100);
  const serviceChargeP = Math.round(taxableP * (Number(serviceChargeRate) || 0) / 100);
  const totalP = taxableP + taxP + serviceChargeP;

  return {
    subtotal: toRupees(subtotalP),
    discount: toRupees(discountP),
    tax: toRupees(taxP),
    serviceCharge: toRupees(serviceChargeP),
    total: toRupees(totalP),
  };
}

/** Split a total evenly across N people, in whole rupees, remainder-safe. */
export function splitEqually(totalRupees, people) {
  if (!people || people < 1) return [];
  const totalP = toPaisa(totalRupees);
  const base = Math.floor(totalP / people);
  const remainder = totalP - base * people;
  return Array.from({ length: people }, (_, i) => toRupees(base + (i < remainder ? 1 : 0)));
}

export function changeDue(amountDueRupees, receivedRupees) {
  const dueP = toPaisa(amountDueRupees);
  const recP = toPaisa(receivedRupees);
  return toRupees(Math.max(recP - dueP, 0));
}
