import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const OrdersContext = createContext(null);
export const useOrders = () => useContext(OrdersContext);

function playNotifySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* ignore */
  }
}

export const OrdersProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]); // {id, title, body, at}
  const knownIds = useRef(new Set());
  const primed = useRef(false);

  const pushNotification = useCallback((title, body) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setNotifications((prev) => [{ id, title, body, at: new Date() }, ...prev].slice(0, 20));
    playNotifySound();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.svg' });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    const [{ data: ordersData, error: oErr }, { data: tablesData, error: tErr }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: true }),
      supabase.from('restaurant_tables').select('*').order('table_number'),
    ]);
    if (oErr) console.error(oErr);
    if (tErr) console.error(tErr);

    const list = ordersData || [];

    // Detect NEW orders (from website or POS) after first load
    if (primed.current) {
      for (const o of list) {
        if (!knownIds.current.has(o.id)) {
          const isDelivery = o.order_type === 'delivery' || o.status === 'pending_confirmation';
          const tableLabel = o.table_id
            ? `Table order`
            : o.customer_name || 'New order';
          const itemsPreview = (o.order_items || [])
            .slice(0, 3)
            .map((li) => `${li.qty}× ${li.item_name}`)
            .join(', ');
          pushNotification(
            isDelivery ? '🌐 New website order' : '🔔 New order',
            `${tableLabel}${o.order_no ? ` #${o.order_no}` : ''} — ${itemsPreview || 'See dashboard'}`
          );
        }
      }
    }

    knownIds.current = new Set(list.map((o) => o.id));
    primed.current = true;

    setOrders(list);
    setTables(tablesData || []);
    setLoading(false);
  }, [pushNotification]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`orders_live_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const confirmOrder = async (orderId) => {
    const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
    if (error) alert(error.message);
  };

  const updateStatus = async (orderId, status) => {
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: status,
    });
    if (error) alert(error.message);
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        tables,
        loading,
        refresh,
        confirmOrder,
        updateStatus,
        notifications,
        dismissNotification,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};
