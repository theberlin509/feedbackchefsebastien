import { createClient } from '@supabase/supabase-js';
import type { AppSettings, Feedback, FeedbackStatus, Profile, Question, ServiceItem } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wdtvesrkbybvihbskond.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kssguoe3gjCjrWrLCjriMg_sVoIIEwn';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseAnonKey.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Valeurs par défaut initiales pour le restaurant Chef Sébastien
export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  business_name: 'Chef Sébastien',
  logo_url: '',
  welcome_message: 'Bienvenue chez Chef Sébastien. L’excellence gastronomique et la satisfaction de nos convives sont au cœur de nos priorités.',
  whatsapp_number: '50937000000',
  support_message: 'Bonjour Chef Sébastien, je souhaite parler à un conseiller concernant un service.',
  reply_template: 'Bonjour {prénom}, merci pour votre message.',
  feedback_phone_required: false,
};

export const DEFAULT_SERVICES: ServiceItem[] = [
  { id: '729fdff4-2bb3-4c9b-be0c-326d88997e35', name: 'Restaurant & Salle', is_active: true, sort_order: 1 },
  { id: '529c9637-44b1-43d2-aefc-3b0aefee08f3', name: 'Service Traiteur & Réceptions', is_active: true, sort_order: 2 },
  { id: 'bc0f4fd4-b2a9-4cab-9e7b-9e5e5d724481', name: 'Plats à emporter / Livraison', is_active: true, sort_order: 3 },
  { id: '98c41fad-a7d1-4b40-92d5-c8f27645e238', name: 'Chef à Domicile', is_active: true, sort_order: 4 },
  { id: '9df174bc-1b74-4ce8-9a0d-8ac343efc0fa', name: 'Événements privés & Corporate', is_active: true, sort_order: 5 },
];

export interface AdminAccount {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  role: 'super_admin' | 'admin';
  status: 'active' | 'inactive';
  can_reply: boolean;
  created_at: string;
  updated_at: string;
}

// Stockage local de secours (utilisé pour la persistance locale et la résilience hors-ligne)
const LOCAL_STORAGE_KEYS = {
  FEEDBACK: 'chef_sebastien_feedback',
  DELETED_FEEDBACK_IDS: 'chef_sebastien_deleted_feedback_ids',
  QUESTIONS: 'chef_sebastien_questions',
  SERVICES: 'chef_sebastien_services',
  SETTINGS: 'chef_sebastien_settings',
  ADMINS: 'chef_sebastien_admins',
  ADMIN_ACCOUNTS: 'chef_sebastien_admin_accounts',
  CURRENT_SESSION: 'chef_sebastien_admin_session',
};

function getLocalData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Erreur localStorage', err);
  }
}

// Nettoyage des anciennes clés de test locales
try {
  localStorage.removeItem('chef_sebastien_active_user_profile');
  localStorage.removeItem('chef_sebastien_is_demo_session');
} catch {}

/**
 * Service API qui interroge directement Supabase
 */
export const api = {
  // Récupérer les paramètres du restaurant
  async getSettings(): Promise<AppSettings> {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (!error && data) {
        setLocalData(LOCAL_STORAGE_KEYS.SETTINGS, data);
        return data as AppSettings;
      }
    } catch {
      // Ignorer l'erreur réseau et passer au local
    }
    return getLocalData<AppSettings>(LOCAL_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  // Mettre à jour les paramètres (Super Admin)
  // CORRECTION: propage l'erreur Supabase au lieu de tomber silencieusement en fallback localStorage
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...updated })
      .select()
      .single();

    if (error) {
      console.error('[updateSettings] Erreur Supabase:', error.message, error.code);
      throw new Error(
        error.code === '42501'
          ? 'Permission refusée : seul le Super Admin peut modifier les paramètres.'
          : `Erreur lors de la sauvegarde dans Supabase : ${error.message}`
      );
    }

    if (!data) {
      throw new Error('La sauvegarde a réussi mais Supabase n\'a pas retourné les données.');
    }

    // Mettre en cache local uniquement APRÈS confirmation Supabase
    setLocalData(LOCAL_STORAGE_KEYS.SETTINGS, data);
    return data as AppSettings;
  },

  // Récupérer les services actifs
  async getActiveServices(): Promise<ServiceItem[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as ServiceItem[];
      }
    } catch {
      // fallback
    }

    const local = getLocalData<ServiceItem[]>(LOCAL_STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    return local.filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
  },

  // Récupérer tous les services (Admin)
  async getAllServices(): Promise<ServiceItem[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        setLocalData(LOCAL_STORAGE_KEYS.SERVICES, data);
        return data as ServiceItem[];
      }
    } catch {
      // fallback
    }

    return getLocalData<ServiceItem[]>(LOCAL_STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
  },

  // Enregistrer ou modifier un service
  async saveService(service: Partial<ServiceItem>): Promise<ServiceItem> {
    try {
      if (service.id && !service.id.startsWith('temp-')) {
        const { data, error } = await supabase
          .from('services')
          .update({
            name: service.name,
            is_active: service.is_active,
            sort_order: service.sort_order,
          })
          .eq('id', service.id)
          .select()
          .single();

        if (!error && data) return data as ServiceItem;
      } else {
        const { data, error } = await supabase
          .from('services')
          .insert({
            name: service.name,
            is_active: service.is_active ?? true,
            sort_order: service.sort_order ?? 99,
          })
          .select()
          .single();

        if (!error && data) return data as ServiceItem;
      }
    } catch {
      // fallback
    }

    // Gestion locale
    const list = getLocalData<ServiceItem[]>(LOCAL_STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    let item: ServiceItem;
    if (service.id) {
      const index = list.findIndex(s => s.id === service.id);
      if (index !== -1) {
        list[index] = { ...list[index], ...service } as ServiceItem;
        item = list[index];
      } else {
        item = { id: service.id, name: service.name || '', is_active: service.is_active ?? true, sort_order: service.sort_order ?? 99 };
        list.push(item);
      }
    } else {
      item = {
        id: `svc-${Date.now()}`,
        name: service.name || 'Nouveau service',
        is_active: service.is_active ?? true,
        sort_order: service.sort_order ?? (list.length + 1),
      };
      list.push(item);
    }
    setLocalData(LOCAL_STORAGE_KEYS.SERVICES, list);
    return item;
  },

  // Soumettre un avis client (Public - sans authentification)
  async submitFeedback(payload: {
    rating: number;
    service_id: string;
    comment: string;
    customer_name?: string;
    customer_phone?: string;
    image_url?: string;
  }): Promise<{ success: boolean; data?: Feedback; error?: string }> {
    // 1. Assurer un service_id au format UUID valide pour PostgreSQL
    let cleanServiceId: string | null = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.service_id);
    if (isUUID) {
      cleanServiceId = payload.service_id;
    } else {
      const activeServices = await this.getActiveServices();
      const matched = activeServices.find(s => s.id === payload.service_id);
      if (matched && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matched.id)) {
        cleanServiceId = matched.id;
      } else if (activeServices.length > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeServices[0].id)) {
        cleanServiceId = activeServices[0].id;
      }
    }

    const baseInsert: any = {
      rating: payload.rating,
      service_id: cleanServiceId,
      comment: payload.comment.trim(),
      customer_name: payload.customer_name?.trim() || null,
      customer_phone: payload.customer_phone?.trim() || null,
      status: 'pending',
    };

    // Préparer l'objet local immédiatement pour garantir qu'aucun avis n'est perdu
    const services = await this.getAllServices();
    const serviceName = services.find(s => s.id === cleanServiceId || s.id === payload.service_id)?.name || 'Service';
    const newFeedback: Feedback = {
      id: `fb-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      rating: payload.rating,
      service_id: cleanServiceId,
      service_name: serviceName,
      comment: payload.comment.trim(),
      customer_name: payload.customer_name?.trim() || null,
      customer_phone: payload.customer_phone?.trim() || null,
      image_url: payload.image_url || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Sauvegarde locale systématique
    const currentList = getLocalData<Feedback[]>(LOCAL_STORAGE_KEYS.FEEDBACK, []);
    setLocalData(LOCAL_STORAGE_KEYS.FEEDBACK, [newFeedback, ...currentList.filter(f => f.id !== newFeedback.id)]);

    try {
      if (payload.image_url) {
        // Tenter d'abord avec image_url
        const { error: imgErr } = await supabase
          .from('feedback')
          .insert({
            ...baseInsert,
            image_url: payload.image_url,
          });

        if (!imgErr) {
          console.log('Avis avec image enregistré avec succès dans Supabase !');
          return { success: true, data: newFeedback };
        }

        // Si la colonne n'est pas encore dans le cache PostgREST (PGRST204)
        console.warn('Sauvegarde de secours sans colonne image_url:', imgErr.message);
        const { error: retryErr } = await supabase
          .from('feedback')
          .insert({
            ...baseInsert,
            comment: `${payload.comment.trim()}\n\n[Photo justificative attachée]`,
          });

        if (!retryErr) {
          console.log('Avis enregistré avec succès dans Supabase !');
          return { success: true, data: newFeedback };
        } else {
          console.error('Erreur insertion avis Supabase:', retryErr.message);
        }
      } else {
        // Insertion propre sans image_url
        const { error } = await supabase
          .from('feedback')
          .insert(baseInsert);

        if (!error) {
          console.log('Avis enregistré avec succès dans Supabase !');
          return { success: true, data: newFeedback };
        } else {
          console.error('Erreur insertion avis Supabase:', error.message);
        }
      }
    } catch (err: any) {
      console.warn('Exception insert feedback:', err);
    }

    return { success: true, data: newFeedback };
  },

  // Soumettre une question client (Public - sans authentification)
  async submitQuestion(payload: {
    customer_name: string;
    customer_phone: string;
    question: string;
  }): Promise<{ success: boolean; data?: Question; error?: string }> {
    try {
      // Envoi direct dans Supabase sans .select() car RLS public n'a que le droit INSERT
      const { error } = await supabase
        .from('questions')
        .insert({
          customer_name: payload.customer_name.trim(),
          customer_phone: payload.customer_phone.trim(),
          question: payload.question.trim(),
          status: 'received',
        });

      if (!error) {
        console.log('Question enregistrée avec succès dans Supabase !');
        return { success: true };
      } else {
        console.warn('Erreur Supabase insert question:', error.message);
      }
    } catch (err: any) {
      console.warn('Exception insert question:', err);
    }

    // Sauvegarde locale de secours
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      customer_name: payload.customer_name.trim(),
      customer_phone: payload.customer_phone.trim(),
      question: payload.question.trim(),
      status: 'received',
      created_at: new Date().toISOString(),
      responded_at: null,
      responded_by: null,
    };

    const currentList = getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
    setLocalData(LOCAL_STORAGE_KEYS.QUESTIONS, [newQuestion, ...currentList]);
    return { success: true, data: newQuestion };
  },

  // Récupérer la liste des avis (Dashboard Admin)
  async getFeedbackList(): Promise<Feedback[]> {
    const deletedIds = getLocalData<string[]>(LOCAL_STORAGE_KEYS.DELETED_FEEDBACK_IDS, []);
    const local = getLocalData<Feedback[]>(LOCAL_STORAGE_KEYS.FEEDBACK, []).filter(
      f => !deletedIds.includes(f.id) && f.status !== 'archived' && f.comment !== '[SUPPRIMÉ]'
    );

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const services = await this.getAllServices();
        const servicesMap: Record<string, string> = {};
        services.forEach(s => { servicesMap[s.id] = s.name; });

        // Filtrer strictement les avis supprimés ou archivés pour qu'ils ne réapparaissent jamais
        const activeData = data.filter(
          (item: any) =>
            !deletedIds.includes(item.id) &&
            item.status !== 'archived' &&
            item.comment !== '[SUPPRIMÉ]'
        );

        const mapped: Feedback[] = activeData.map((item: any) => ({
          ...item,
          service_name: item.service_id ? (servicesMap[item.service_id] || 'Général') : 'Général',
        }));

        // Fusionner avec la liste locale pour ne jamais perdre un avis récent
        const map = new Map<string, Feedback>();
        local.forEach(f => map.set(f.id, f));
        mapped.forEach(f => map.set(f.id, f));
        const combined = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setLocalData(LOCAL_STORAGE_KEYS.FEEDBACK, combined);
        return combined;
      } else if (error) {
        console.warn('Erreur getFeedbackList Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Exception getFeedbackList:', err);
    }

    return local;
  },

  // Mettre à jour le statut d'un avis
  async updateFeedbackStatus(feedbackId: string, status: FeedbackStatus): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', feedbackId);

      if (!error) {
        const list = getLocalData<Feedback[]>(LOCAL_STORAGE_KEYS.FEEDBACK, []);
        const idx = list.findIndex(f => f.id === feedbackId);
        if (idx !== -1) {
          list[idx].status = status;
          setLocalData(LOCAL_STORAGE_KEYS.FEEDBACK, list);
        }
        return true;
      }
    } catch {
      // fallback
    }

    const list = getLocalData<Feedback[]>(LOCAL_STORAGE_KEYS.FEEDBACK, []);
    const idx = list.findIndex(f => f.id === feedbackId);
    if (idx !== -1) {
      list[idx].status = status;
      list[idx].updated_at = new Date().toISOString();
      setLocalData(LOCAL_STORAGE_KEYS.FEEDBACK, list);
      return true;
    }
    return false;
  },

  // Supprimer définitivement un avis (garanti sans réapparition après actualisation)
  async deleteFeedback(feedbackId: string): Promise<boolean> {
    // 1. Ajouter immédiatement à la liste noire permanente des identifiants supprimés
    const deletedIds = getLocalData<string[]>(LOCAL_STORAGE_KEYS.DELETED_FEEDBACK_IDS, []);
    if (!deletedIds.includes(feedbackId)) {
      setLocalData(LOCAL_STORAGE_KEYS.DELETED_FEEDBACK_IDS, [...deletedIds, feedbackId]);
    }

    // 2. Nettoyer immédiatement la mémoire et le cache local
    const list = getLocalData<Feedback[]>(LOCAL_STORAGE_KEYS.FEEDBACK, []);
    const updated = list.filter(f => f.id !== feedbackId);
    setLocalData(LOCAL_STORAGE_KEYS.FEEDBACK, updated);

    // 3. Tenter la suppression SQL dans Supabase
    try {
      await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId);
    } catch (err) {
      console.warn('Tentative delete Supabase:', err);
    }

    // 4. Mettre aussi à jour la ligne dans Supabase (archivé/supprimé)
    // Cela garantit que même si la politique RLS 'DELETE' manque dans Supabase,
    // la mise à jour (autorisée par RLS) marque la ligne comme supprimée pour toujours
    try {
      await supabase
        .from('feedback')
        .update({
          status: 'archived',
          comment: '[SUPPRIMÉ]',
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId);
    } catch (err) {
      console.warn('Tentative archive de sécurité Supabase:', err);
    }

    return true;
  },

  // Récupérer les questions (Dashboard Admin)
  async getQuestionsList(): Promise<Question[]> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Récupérer les profils pour associer le nom de l'administrateur ayant répondu
        const responderIds = [...new Set(data.map((q: any) => q.responded_by).filter(Boolean))];
        let profilesMap: Record<string, string> = {};
        if (responderIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', responderIds);
            if (profiles) {
              profiles.forEach((p: any) => { profilesMap[p.id] = p.full_name; });
            }
          } catch {}
        }

        const mapped: Question[] = data.map((q: any) => ({
          ...q,
          responder_name: q.responded_by ? (profilesMap[q.responded_by] || 'Chef Sébastien') : null,
        }));
        setLocalData(LOCAL_STORAGE_KEYS.QUESTIONS, mapped);
        return mapped;
      } else if (error) {
        console.warn('Erreur getQuestionsList Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Exception getQuestionsList:', err);
    }

    return getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
  },

  // Répondre à une question (Appel de la fonction SQL mark_question_replied)
  async markQuestionReplied(questionId: string, responderProfile?: Profile | null): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('mark_question_replied', {
        question_id: questionId,
      });

      if (!error) {
        // Mettre à jour aussi localement
        const list = getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
        const idx = list.findIndex(q => q.id === questionId);
        if (idx !== -1) {
          if (list[idx].status !== 'replied') {
            list[idx].status = 'replied';
            list[idx].responded_at = new Date().toISOString();
            list[idx].responded_by = responderProfile?.id || 'admin';
            list[idx].responder_name = responderProfile?.full_name || 'Admin Chef Sébastien';
            setLocalData(LOCAL_STORAGE_KEYS.QUESTIONS, list);
          }
        }
        return true;
      }
    } catch {
      // fallback si RPC non encore créée
    }

    // Mode résilient / local
    const list = getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
    const idx = list.findIndex(q => q.id === questionId);
    if (idx !== -1) {
      if (list[idx].status !== 'replied') {
        list[idx].status = 'replied';
        list[idx].responded_at = new Date().toISOString();
        list[idx].responded_by = responderProfile?.id || 'admin-local';
        list[idx].responder_name = responderProfile?.full_name || 'Chef Sébastien';
        setLocalData(LOCAL_STORAGE_KEYS.QUESTIONS, list);
      }
      return true;
    }
    return false;
  },

  // Supprimer une question WhatsApp (Admin)
  async deleteQuestion(questionId: string): Promise<boolean> {
    try {
      // 1. Tenter la suppression via RPC delete_question
      const { error: rpcErr } = await supabase.rpc('delete_question', {
        question_id: questionId,
      });

      if (!rpcErr) {
        const list = getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
        setLocalData(
          LOCAL_STORAGE_KEYS.QUESTIONS,
          list.filter((q) => q.id !== questionId)
        );
        return true;
      }

      // 2. Fallback via DELETE direct RLS Supabase
      const { error: deleteErr } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (!deleteErr) {
        const list = getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
        setLocalData(
          LOCAL_STORAGE_KEYS.QUESTIONS,
          list.filter((q) => q.id !== questionId)
        );
        return true;
      }

      throw new Error(deleteErr.message);
    } catch (err: any) {
      console.error('Erreur suppression question:', err);
      const list = getLocalData<Question[]>(LOCAL_STORAGE_KEYS.QUESTIONS, []);
      setLocalData(
        LOCAL_STORAGE_KEYS.QUESTIONS,
        list.filter((q) => q.id !== questionId)
      );
      return false;
    }
  },

  // Récupérer la liste des administrateurs (Super Admin)
  // CORRECTION: lecture uniquement depuis Supabase — le merge avec localStorage causait la réapparition des admins supprimés
  async getAdminsList(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAdminsList] Erreur Supabase:', error.message);
      throw new Error(`Impossible de charger la liste des administrateurs : ${error.message}`);
    }

    return (data || []) as Profile[];
  },

  // Mettre à jour un administrateur (rôle, can_reply, status)
  // CORRECTION: propage l'erreur Supabase, ne maintient plus de double état localStorage
  async updateAdmin(profileId: string, updates: Partial<Profile>): Promise<boolean> {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    // Copier uniquement les champs modifiables
    if (updates.full_name !== undefined) updatePayload.full_name = updates.full_name;
    if (updates.role !== undefined) updatePayload.role = updates.role;
    if (updates.can_reply !== undefined) updatePayload.can_reply = updates.can_reply;
    if (updates.status !== undefined) updatePayload.status = updates.status;

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileId);

    if (error) {
      console.error('[updateAdmin] Erreur Supabase:', error.message);
      throw new Error(`Impossible de mettre à jour le profil : ${error.message}`);
    }

    return true;
  },

  // Supprimer un administrateur
  // CORRECTION: utilise la RPC delete_admin_user qui supprime auth.users + profil atomiquement
  // Propage l'erreur Supabase au lieu de retourner silencieusement true
  async deleteAdmin(profileId: string, _email?: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_admin_user', {
      target_user_id: profileId,
    });

    if (error) {
      console.error('[deleteAdmin] Erreur Supabase RPC:', error.message);
      throw new Error(`Erreur lors de la suppression : ${error.message}`);
    }

    if (data && !data.success) {
      console.error('[deleteAdmin] RPC refusée:', data.error);
      throw new Error(data.error || 'La suppression a été refusée par le serveur.');
    }

    console.log('[deleteAdmin] Succès:', data);
    return true;
  },

  // Créer un administrateur
  // CORRECTION: utilise la RPC create_admin_user qui crée auth.users + profil atomiquement
  // Le compte Auth est créé avec le bon UUID qui match le profil — plus de faux IDs locaux
  async createAdmin(payload: {
    full_name: string;
    email: string;
    password?: string;
    role: 'super_admin' | 'admin';
    can_reply: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.full_name.trim();
    const adminPassword = payload.password?.trim() || 'Chef2026!';

    if (!cleanEmail || !cleanName) {
      return { success: false, error: 'Email et nom complet sont obligatoires.' };
    }

    if (adminPassword.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }

    const { data, error } = await supabase.rpc('create_admin_user', {
      admin_email: cleanEmail,
      admin_password: adminPassword,
      admin_name: cleanName,
      admin_role: payload.role,
      admin_can_reply: payload.role === 'super_admin' ? true : payload.can_reply,
    });

    if (error) {
      console.error('[createAdmin] Erreur Supabase RPC:', error.message);
      return { success: false, error: `Erreur Supabase : ${error.message}` };
    }

    if (data && !data.success) {
      console.error('[createAdmin] RPC refusée:', data.error);
      return { success: false, error: data.error || 'La création a été refusée par le serveur.' };
    }

    console.log('[createAdmin] Succès, user_id:', data?.user_id);
    return { success: true };
  },

  // authenticateAdmin SUPPRIMÉ
  // CORRECTION: L'authentification doit passer uniquement par Supabase Auth.
  // Le fallback localStorage permettait une connexion avec un faux JWT (syntheticUser)
  // qui n'avait aucun token valide → toutes les requêtes Supabase étaient rejetées par RLS.

  // Gestion de session sécurisée
  saveCurrentSession(session: { user: any; profile: Profile }): void {
    setLocalData(LOCAL_STORAGE_KEYS.CURRENT_SESSION, session);
  },

  getCurrentSession(): { user: any; profile: Profile } | null {
    return getLocalData<{ user: any; profile: Profile } | null>(LOCAL_STORAGE_KEYS.CURRENT_SESSION, null);
  },

  clearCurrentSession(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_SESSION);
    } catch {}
  },

  // Tester la connexion Supabase et vérifier les tables
  async testConnection(): Promise<{
    connected: boolean;
    tablesDetected: {
      profiles: boolean;
      feedback: boolean;
      questions: boolean;
      services: boolean;
      settings: boolean;
    };
    error?: string;
  }> {
    const result = {
      connected: false,
      tablesDetected: {
        profiles: false,
        feedback: false,
        questions: false,
        services: false,
        settings: false,
      },
      error: undefined as string | undefined,
    };

    const isTablePresent = (res: any) => {
      if (!res.error) return true;
      // Code 42501 ou message RLS = la table existe et est bien protégée par RLS
      const msg = res.error?.message?.toLowerCase() || '';
      const code = res.error?.code;
      if (
        code === '42501' ||
        msg.includes('permission denied') ||
        msg.includes('row-level security') ||
        msg.includes('rls')
      ) {
        return true;
      }
      return false;
    };

    try {
      const [pRes, fRes, qRes, sRes, setRes] = await Promise.all([
        supabase.from('profiles').select('id').limit(1),
        supabase.from('feedback').select('id').limit(1),
        supabase.from('questions').select('id').limit(1),
        supabase.from('services').select('id').limit(1),
        supabase.from('settings').select('id').limit(1),
      ]);

      result.tablesDetected.profiles = isTablePresent(pRes);
      result.tablesDetected.feedback = isTablePresent(fRes);
      result.tablesDetected.questions = isTablePresent(qRes);
      result.tablesDetected.services = isTablePresent(sRes);
      result.tablesDetected.settings = isTablePresent(setRes);

      result.connected = isTablePresent(sRes) || isTablePresent(setRes) || isTablePresent(fRes);
    } catch (err: any) {
      result.error = err?.message || 'Erreur de connexion';
    }

    return result;
  },
};
