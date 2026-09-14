import { create } from 'zustand';

const emptyCart = {
  orderType: 'dine_in',   // 'dine_in' | 'takeaway'
  tableId: null,
  tableLabel: null,
  lines: [],               // [{ lineId, menuItemId, name, price, qty, notes, maxStock }]
  discountAmount: 0,
  taxRate: 0,
  serviceChargeRate: 0,
};

export const useCartStore = create((set, get) => ({
  ...emptyCart,
  heldOrders: [],           // [{ id, label, heldAt, snapshot }]

  setOrderType: (orderType) => set({ orderType }),
  setTable: (tableId, tableLabel) => set({ tableId, tableLabel, orderType: 'dine_in' }),
  clearTable: () => set({ tableId: null, tableLabel: null }),

  addItem: (item) => set((state) => {
    const existing = state.lines.find((l) => l.menuItemId === item.id && !l.notes);
    if (existing) {
      if (existing.maxStock != null && existing.qty + 1 > existing.maxStock) return state;
      return { lines: state.lines.map((l) => (l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l)) };
    }
    return {
      lines: [
        ...state.lines,
        {
          lineId: crypto.randomUUID(),
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
          notes: '',
          maxStock: item.stock_qty ?? null,
        },
      ],
    };
  }),

  incrementLine: (lineId) => set((state) => ({
    lines: state.lines.map((l) => {
      if (l.lineId !== lineId) return l;
      if (l.maxStock != null && l.qty + 1 > l.maxStock) return l;
      return { ...l, qty: l.qty + 1 };
    }),
  })),

  decrementLine: (lineId) => set((state) => ({
    lines: state.lines
      .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l))
      .filter((l) => l.qty > 0),
  })),

  removeLine: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

  setLineNotes: (lineId, notes) => set((state) => ({
    lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, notes } : l)),
  })),

  setDiscountAmount: (discountAmount) => set({ discountAmount: Math.max(0, Number(discountAmount) || 0) }),
  setTaxRate: (taxRate) => set({ taxRate: Math.max(0, Number(taxRate) || 0) }),
  setServiceChargeRate: (serviceChargeRate) => set({ serviceChargeRate: Math.max(0, Number(serviceChargeRate) || 0) }),

  clearCart: () => set({ ...emptyCart }),

  holdOrder: (label) => set((state) => {
    if (state.lines.length === 0) return {};
    const snapshot = {
      orderType: state.orderType,
      tableId: state.tableId,
      tableLabel: state.tableLabel,
      lines: state.lines,
      discountAmount: state.discountAmount,
      taxRate: state.taxRate,
      serviceChargeRate: state.serviceChargeRate,
    };
    return {
      heldOrders: [
        ...state.heldOrders,
        { id: crypto.randomUUID(), label: label || `Held order ${state.heldOrders.length + 1}`, heldAt: Date.now(), snapshot },
      ],
      ...emptyCart,
    };
  }),

  resumeOrder: (id) => set((state) => {
    const held = state.heldOrders.find((h) => h.id === id);
    if (!held) return {};
    return { ...held.snapshot, heldOrders: state.heldOrders.filter((h) => h.id !== id) };
  }),

  discardHeldOrder: (id) => set((state) => ({ heldOrders: state.heldOrders.filter((h) => h.id !== id) })),
}));
