import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string, role?: 'worker' | 'manager') => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await useAuthStore.getState().loadUser();
    return {};
  },

  signUp: async (email, password, fullName, role = 'worker') => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role,
      });
    }
    await useAuthStore.getState().loadUser();
    return {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  loadUser: async () => {
    set({ loading: true });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      set({ user: null, loading: false });
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    set({ user: data, loading: false });
  },
}));
