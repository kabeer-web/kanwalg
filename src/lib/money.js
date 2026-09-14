// All arithmetic happens in integer "minor units" (paisa) — never floats —
// so repeated additions/discounts/tax never drift by a fraction of a rupee.
// Convert to/from rupees only at the DB boundary and for display.

export const toMinor = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toMajor = (minor) => Number(minor || 0) / 100;

export const formatMoney = (minor, currency = 'Rs.') =>
  `${currency} ${toMajor(minor).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
