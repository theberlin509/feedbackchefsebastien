import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, api } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  canReply: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger le profil de l'utilisateur connecté depuis la table profiles de Supabase
  const fetchUserProfile = async (userId: string, userEmail?: string | null): Promise<Profile | null> => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Si le profil n'est pas trouvé par ID mais qu'on a l'email, chercher par email
      if (!data && userEmail) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', userEmail.trim().toLowerCase())
          .maybeSingle();

        if (byEmail) {
          try {
            await supabase.from('profiles').update({ id: userId }).eq('email', userEmail.trim().toLowerCase());
          } catch {}
          data = { ...byEmail, id: userId };
        }
      }

      // Si le profil n'existe pas du tout mais que l'utilisateur est authentifié dans Supabase Auth,
      // créer automatiquement son profil pour éviter tout blocage d'accès
      if (!data && userEmail) {
        const cleanEmail = userEmail.trim().toLowerCase();
        const isSuperAdmin = cleanEmail === 'informatiquechefsebastien@gmail.com';
        const fallbackProfile = {
          id: userId,
          full_name: userEmail.split('@')[0],
          email: cleanEmail,
          role: isSuperAdmin ? 'super_admin' : 'admin',
          status: 'active',
          can_reply: true,
        };

        try {
          const { data: created } = await supabase
            .from('profiles')
            .upsert(fallbackProfile)
            .select('*')
            .maybeSingle();

          if (created) {
            data = created;
          } else {
            data = fallbackProfile as any;
          }
        } catch {
          data = fallbackProfile as any;
        }
      }

      if (error && !data) {
        console.error('Erreur récupération profil Supabase:', error.message);
        return null;
      }

      if (data) {
        const p = data as Profile;
        // Si le compte est marqué inactif, déconnexion immédiate de sécurité
        if (p.status !== 'active') {
          console.warn('Compte inactif détecté : accès révoqué.');
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return null;
        }

        setProfile(p);
        return p;
      }
    } catch (err) {
      console.error('Exception profil Supabase:', err);
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          setUser(session.user);
          await fetchUserProfile(session.user.id, session.user.email);
        } else if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        console.error('Erreur initAuth:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Écoute des changements de session Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Authentification uniquement via Supabase Auth
  // CORRECTION: Suppression du fallback localStorage qui permettait une connexion avec un faux JWT
  // Ce faux JWT causait des rejets RLS sur toutes les requêtes Supabase suivantes
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        console.error('[login] Erreur Supabase Auth:', error.message);
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Adresse email ou mot de passe incorrect.' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: 'Votre compte n\'a pas encore été confirmé.' };
        }
        return { success: false, error: 'Adresse email ou mot de passe incorrect, ou accès non autorisé.' };
      }

      if (!data?.user) {
        return { success: false, error: 'Aucune session retournée par Supabase.' };
      }

      setUser(data.user);
      const userProfile = await fetchUserProfile(data.user.id, data.user.email);

      if (!userProfile) {
        // Le compte Auth existe mais aucun profil actif trouvé
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Votre compte existe mais votre profil est introuvable ou désactivé. Contactez l\'administrateur principal.',
        };
      }

      setProfile(userProfile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Une erreur de connexion est survenue.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    api.clearCurrentSession();
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin/login`,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Échec de la réinitialisation.' };
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  // Règles de sécurité : vérification stricte du profil actif en base
  const isSuperAdmin = profile?.role === 'super_admin' && profile?.status === 'active';
  const isAdmin = profile?.status === 'active';
  const canReply = isSuperAdmin || (profile?.can_reply === true && profile?.status === 'active');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isSuperAdmin: Boolean(isSuperAdmin),
        isAdmin: Boolean(isAdmin),
        canReply: Boolean(canReply),
        login,
        logout,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
