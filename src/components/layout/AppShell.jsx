import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, UtensilsCrossed, ChefHat, Receipt, BookOpen, QrCode,
  LogOut, ChevronsLeft, Wifi, WifiOff, Clock, User, Package, History, Bell, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStaff } from '../../context/StaffContext';
import { useShift } from '../../context/ShiftContext';
import ShiftModal from '../pos/ShiftModal';
import { useOrders } from '../../context/OrdersContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: UtensilsCrossed },
  { to: '/kds', label: 'Kitchen', icon: ChefHat },
  { to: '/billing', label: 'Billing', icon: Receipt },
  { to: '/menu-admin', label: 'Menu & Stock', icon: BookOpen },
  { to: '/ingredients', label: 'Ingredients', icon: Package },
  { to: '/tables', label: 'Table QR', icon: QrCode },
  { to: '/history', label: 'History', icon: History },
];

const ROLE_LABEL = {
  owner: 'Owner', manager: 'Manager', cashier: 'Cashier',
  kitchen: 'Kitchen Staff', waiter: 'Waiter', delivery: 'Delivery Staff',
};

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

function ShiftClock({ openedAt }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(openedAt).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [openedAt]);
  return <span>{elapsed}</span>;
}

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const { signOut } = useAuth();
  const { profile } = useStaff();
  const { shift, loading: shiftLoading } = useShift();
  const online = useOnlineStatus();
  const { notifications, dismissNotification } = useOrders() || { notifications: [], dismissNotification: () => {} };

  return (
    <div className="h-screen w-screen flex bg-bg overflow-hidden">
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex-shrink-0 border-r border-border bg-surface flex flex-col relative z-20"
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-glow-sm">
            <UtensilsCrossed size={15} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="font-semibold text-ink text-[15px] tracking-tight truncate"
              >
                BeerFlow
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-4 px-2.5 space-y-0.5 overflow-y-auto no-scrollbar">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `relative group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent/10 text-ink'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-brand-gradient"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <Icon
                    size={18}
                    className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-ink-faint group-hover:text-ink-muted'}`}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2.5 border-t border-border space-y-0.5">
          <button
            onClick={signOut}
            title={collapsed ? 'Sign Out' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-ink-muted hover:text-danger hover:bg-danger-soft transition-colors"
          >
            <LogOut size={18} className="flex-shrink-0" strokeWidth={1.75} />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
              <ChevronsLeft size={18} strokeWidth={1.75} />
            </motion.span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex-shrink-0 border-b border-border bg-surface/70 backdrop-blur-md flex items-center gap-3 px-5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {online ? (
              <span className="flex items-center gap-1.5 text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-40" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-danger">
                <WifiOff size={12} /> Offline
              </span>
            )}
          </div>

          <div className="w-px h-4 bg-border" />

          {!shiftLoading && (
            <button
              onClick={() => setShiftModalOpen(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                shift
                  ? 'bg-success-soft text-success hover:brightness-110'
                  : 'bg-warning-soft text-warning hover:brightness-110'
              }`}
            >
              <Clock size={12} />
              {shift ? (
                <>Shift · <ShiftClock openedAt={shift.opened_at} /></>
              ) : (
                'Open Shift'
              )}
            </button>
          )}

          <div className="flex-1" />

          {profile && (
            <div className="flex items-center gap-2.5 pl-2">
              <div className="text-right leading-tight hidden sm:block">
                <p className="text-ink font-medium text-xs">{profile.full_name || 'Staff'}</p>
                <p className="text-ink-faint text-[11px]">{ROLE_LABEL[profile.role] || profile.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-start to-brand-end flex items-center justify-center flex-shrink-0 ring-2 ring-border">
                <User size={14} className="text-white" />
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto min-w-0 bg-bg">{children}</main>
      </div>

      {/* Live order notifications from website / POS */}
      <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {(notifications || []).slice(0, 4).map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className="pointer-events-auto rounded-xl border border-accent/30 bg-surface shadow-elevated px-4 py-3 flex gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Bell size={14} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{n.title}</p>
                <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.body}</p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="text-ink-faint hover:text-ink flex-shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ShiftModal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} />
    </div>
  );
}
