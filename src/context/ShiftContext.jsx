import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ShiftContext = createContext(null);
export const useShift = () => useContext(ShiftContext);

export const ShiftProvider = ({ children }) => {
  const { user } = useAuth();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setShift(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('opened_by', user.id)
      .eq('status', 'open')
      .maybeSingle();
    if (error) console.error(error);
    setShift(data || null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const openShift = async (openingCash) => {
    const { data, error } = await supabase.rpc('open_shift', { p_opening_cash: openingCash });
    if (error) { alert(error.message); return null; }
    setShift(data);
    return data;
  };

  const closeShift = async (closingCash) => {
    if (!shift) return null;
    const { data, error } = await supabase.rpc('close_shift', { p_shift_id: shift.id, p_closing_cash: closingCash });
    if (error) { alert(error.message); return null; }
    setShift(null);
    return data;
  };

  return (
    <ShiftContext.Provider value={{ shift, loading, openShift, closeShift, refresh }}>
      {children}
    </ShiftContext.Provider>
  );
};
