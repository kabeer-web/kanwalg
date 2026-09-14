import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrdersProvider } from './context/OrdersContext';
import { StaffProvider } from './context/StaffContext';
import { ShiftProvider } from './context/ShiftContext';
import AppShell from './components/layout/AppShell';
import CustomerMenu from './pages/CustomerMenu';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import KDS from './pages/KDS';
import Billing from './pages/Billing';
import MenuManagement from './pages/MenuManagement';
import TableQR from './pages/TableQR';
import Login from './pages/Login';
import Ingredients from './pages/Ingredients';
import History from './pages/History';

function RequireStaff({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-ink flex items-center justify-center font-display">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <StaffProvider>
      <ShiftProvider>
        <OrdersProvider>
          <AppShell>{children}</AppShell>
        </OrdersProvider>
      </ShiftProvider>
    </StaffProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CustomerMenu />} />
          <Route path="/menu" element={<CustomerMenu />} />
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={<RequireStaff><Dashboard /></RequireStaff>} />
          <Route path="/pos" element={<RequireStaff><POS /></RequireStaff>} />
          <Route path="/kds" element={<RequireStaff><KDS /></RequireStaff>} />
          <Route path="/billing" element={<RequireStaff><Billing /></RequireStaff>} />
          <Route path="/menu-admin" element={<RequireStaff><MenuManagement /></RequireStaff>} />
          <Route path="/ingredients" element={<RequireStaff><Ingredients /></RequireStaff>} />
          <Route path="/tables" element={<RequireStaff><TableQR /></RequireStaff>} />
          <Route path="/history" element={<RequireStaff><History /></RequireStaff>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
