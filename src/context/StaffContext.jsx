import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const StaffContext = createContext(null);
export const useStaff = () => useContext(StaffContext);

// Loads the staff_profiles row (role, active flag) tied to the logged-in
// auth user. A first-time sign-in auto-creates this row (see schema v2
// trigger) but it starts deactivated — an owner/manager must flip it on
// and assign a real role before the person can act as staff.
export const StaffProvider = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('staff_profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) console.error(error);
    setProfile(data || null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const hasRole = useCallback((...roles) => !!profile?.is_active && roles.includes(profile.role), [profile]);

  return (
    <StaffContext.Provider value={{ profile, loading, hasRole, refresh }}>
      {children}
    </StaffContext.Provider>
  );
};
