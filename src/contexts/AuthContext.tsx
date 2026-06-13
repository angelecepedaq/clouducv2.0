"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, website, rol, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error al obtener perfil:', error);
    return null;
  }
  return data as Profile | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: string | null }>;
  signUpWithUsername: (username: string, email: string, password: string) => Promise<{ error: string | null, needsEmailConfirmation?: boolean }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); return; }
    const p = await getProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) getProfile(session.user.id).then(setProfile);
      })
      .finally(() => setLoading(false));

    // En este listener NO usar await — usar .then() para evitar deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithUsername = async (loginId: string, password: string): Promise<{ error: string | null }> => {
    // Require an email for sign-in to avoid legacy external redirects.
    if (!loginId.includes('@')) {
      return { error: 'Por favor ingresa tu correo electrónico' };
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginId, password });
    if (!error) return { error: null };

    const msg = error.message.toLowerCase();
    if (msg.includes('invalid') || msg.includes('credentials')) return { error: 'Usuario o contraseña incorrectos' };
    if (msg.includes('not found') || msg.includes('no user')) return { error: 'Usuario no encontrado' };
    return { error: 'Error de conexión. Intenta nuevamente.' };
  };

  const signUpWithUsername = async (username: string, email: string, password: string): Promise<{ error: string | null, needsEmailConfirmation?: boolean }> => {
    // Verificar si el username ya existe
    const { data: profileExists } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (profileExists) {
      return { error: 'El nombre de usuario ya está en uso' };
    }

    // Pasamos username en metadata para que handle_new_user lo pueda usar
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (!error) {
      // Si la sesión es null, Supabase requiere confirmación de email
      const needsEmailConfirmation = authData.user && authData.session === null;
      return { error: null, needsEmailConfirmation: !!needsEmailConfirmation };
    }

    const msg = error.message.toLowerCase();
    if (msg.includes('already') || msg.includes('registered')) return { error: 'El correo electrónico ya está registrado' };
    return { error: 'Error al crear la cuenta. Intenta nuevamente.' };
  };

  const resetPasswordForEmail = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) return { error: 'Error al enviar el enlace. Intenta nuevamente.' };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithUsername, signUpWithUsername, resetPasswordForEmail, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
