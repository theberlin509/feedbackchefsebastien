import React, { useEffect, useState } from 'react';
import {
  MessageCircle,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Trash2,
} from 'lucide-react';
import { api } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  buildReplyMessage,
  formatPhoneForWhatsApp,
  generateWhatsAppLink,
} from '../../lib/whatsapp';
import type { AppSettings, Question, QuestionStatus } from '../../types/database';

export const QuestionsList: React.FC = () => {
  const { canReply, profile } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'received' | 'replied'>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [qList, s] = await Promise.all([
        api.getQuestionsList(),
        api.getSettings(),
      ]);
      setQuestions(qList);
      setSettings(s);
    } catch (err) {
      console.error('Erreur chargement questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteQuestion = async (id: string) => {
    if (deletingId) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) return;

    setDeletingId(id);
    setActionError(null);
    try {
      const ok = await api.deleteQuestion(id);
      if (ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      } else {
        setActionError('Échec de la suppression de la question dans Supabase.');
      }
    } catch (err: any) {
      setActionError(`Erreur lors de la suppression : ${err.message || 'Échec API'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Compteurs exacts demandés
  const countAll = questions.length;
  const countReceived = questions.filter((q) => q.status === 'received').length;
  const countReplied = questions.filter((q) => q.status === 'replied').length;

  // Filtrage selon les 3 seuls filtres autorisés
  const filteredQuestions = questions.filter((q) => {
    if (activeFilter === 'received') return q.status === 'received';
    if (activeFilter === 'replied') return q.status === 'replied';
    return true; // 'all'
  });

  // Action du bouton [ Répondre ] en UN SEUL CLIC
  const handleReplyClick = async (questionItem: Question) => {
    setActionError(null);

    // Contrôle de permission côté client
    if (!canReply) {
      setActionError(
        'Vous êtes en mode consultation seule. Seuls les administrateurs autorisés peuvent répondre.'
      );
      return;
    }

    // 1 & 2. Construire le message et le lien wa.me
    const template =
      settings?.reply_template || 'Bonjour {prénom}, merci pour votre message.';
    const replyText = buildReplyMessage(template, questionItem.customer_name);
    const cleanPhone = formatPhoneForWhatsApp(questionItem.customer_phone);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(replyText)}`;

    // 3. Ouvrir WhatsApp DIRECTEMENT dans le gestionnaire de clic (évite le popup blocker mobile)
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // 4. Appel en parallèle pour marquer la question comme répondue dans Supabase
    // Note: Si déjà 'replied', la fonction backend et l'API préservent le responded_at et responded_by initial
    try {
      const ok = await api.markQuestionReplied(questionItem.id, profile);
      if (!ok && questionItem.status === 'received') {
        setActionError(
          'Attention : WhatsApp a été ouvert, mais la mise à jour du statut en base a échoué. Le statut reste "REÇUE".'
        );
      } else {
        // Mettre à jour l'état local immédiatement
        setQuestions((prev) =>
          prev.map((q) => {
            if (q.id === questionItem.id && q.status === 'received') {
              return {
                ...q,
                status: 'replied',
                responded_at: new Date().toISOString(),
                responded_by: profile?.id || 'admin',
                responder_name: profile?.full_name || 'Chef Sébastien',
              };
            }
            return q;
          })
        );
      }
    } catch (err: any) {
      setActionError(
        `Erreur non bloquante : ${err.message || 'Échec de marquage en base.'}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900">
            Questions WhatsApp
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Répondez directement aux clients sur WhatsApp en un seul clic
          </p>
        </div>

        {!canReply && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium self-start sm:self-auto">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Consultation seule (droit de réponse non activé)</span>
          </div>
        )}
      </div>

      {actionError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{actionError}</div>
          <button
            onClick={() => setActionError(null)}
            className="text-stone-400 hover:text-stone-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3 Filtres Uniques : Toutes / Reçues / Répondues avec Compteurs */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-stone-200 shadow-xs max-w-md">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'all'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Toutes ({countAll})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('received')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'received'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Reçues ({countReceived})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('replied')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'replied'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Répondues ({countReplied})
        </button>
      </div>

      {/* Liste des Questions */}
      {loading ? (
        <div className="py-12 text-center text-stone-400 text-sm">
          Chargement des questions...
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-stone-200">
          <MessageCircle className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-700 font-medium">Aucune question dans cette catégorie.</p>
          <p className="text-xs text-stone-400 mt-1">
            Les questions envoyées depuis le formulaire public apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const isReplied = q.status === 'replied';

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${
                  !isReplied
                    ? 'border-amber-300/80 bg-amber-50/15 ring-1 ring-amber-200/50'
                    : 'border-stone-200'
                }`}
              >
                {/* Ligne 1 : Nom, Téléphone, Date et Badge Statut */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-stone-900 text-sm">
                      {q.customer_name}
                    </span>
                    <span className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 font-medium">
                      {q.customer_phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(q.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {/* Badge REÇUE / RÉPONDUE */}
                    {isReplied ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>RÉPONDUE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        REÇUE
                      </span>
                    )}
                  </div>
                </div>

                {/* Corps de la Question */}
                <div className="my-3.5 text-stone-800 text-sm leading-relaxed bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
                  « {q.question} »
                </div>

                {/* Pied de Carte : Métadonnées Réponse + Bouton [ Répondre ] */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-stone-500">
                    {isReplied && q.responded_at ? (
                      <span className="text-stone-600 font-medium">
                        ✓ Répondue le{' '}
                        {new Date(q.responded_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        {q.responder_name ? `par ${q.responder_name}` : ''}
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        En attente de réponse sur WhatsApp
                      </span>
                    )}
                  </div>

                  {/* Boutons d'Action: Répondre + Supprimer */}
                  <div className="flex items-center gap-2">
                    {canReply ? (
                      <button
                        type="button"
                        onClick={() => handleReplyClick(q)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xs transition-all active:scale-95 touch-manipulation ${
                          isReplied
                            ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/10'
                        }`}
                        title={
                          isReplied
                            ? 'Réouvrir la conversation WhatsApp (statut conservé)'
                            : 'Ouvrir WhatsApp et marquer comme répondue'
                        }
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>
                          {isReplied ? 'Répondre à nouveau' : 'Répondre'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 text-stone-400 text-xs font-medium cursor-not-allowed border border-stone-200"
                        title="Votre profil ne dispose pas de la permission de répondre"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Répondre (désactivé)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      disabled={deletingId === q.id}
                      className="inline-flex items-center justify-center p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                      title="Supprimer cette question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
