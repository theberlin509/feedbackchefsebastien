import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Sparkles,
  Phone,
  Trash2,
} from 'lucide-react';
import { api } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { buildReplyMessage, openWhatsApp } from '../../lib/whatsapp';
import type { AppSettings, Feedback, Question } from '../../types/database';

export const AdminDashboard: React.FC = () => {
  const { canReply, profile } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger les données
  const loadDashboardData = async () => {
    try {
      const [fb, q, s] = await Promise.all([
        api.getFeedbackList(),
        api.getQuestionsList(),
        api.getSettings(),
      ]);
      setFeedbackList(fb);
      setQuestionsList(q);
      setSettings(s);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) return;
    try {
      await api.deleteQuestion(id);
      setQuestionsList((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      console.error('Erreur suppression question:', err);
    }
  };

  // Calcul des statistiques
  const totalFeedback = feedbackList.length;
  const averageRating =
    totalFeedback > 0
      ? (
          feedbackList.reduce((acc, curr) => acc + curr.rating, 0) /
          totalFeedback
        ).toFixed(1)
      : '0.0';

  const now = new Date();
  const currentMonthFeedback = feedbackList.filter((f) => {
    const d = new Date(f.created_at);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  const pendingQuestions = questionsList.filter((q) => q.status === 'received');
  const alertFeedback = feedbackList.filter(
    (f) => f.rating <= 2 && f.status !== 'resolved'
  );

  // Handler de réponse WhatsApp directe depuis le dashboard
  const handleQuickReply = async (q: Question) => {
    if (!canReply) return;

    // 1. Message et ouverture WhatsApp
    const message = buildReplyMessage(
      settings?.reply_template || 'Bonjour {prénom}, merci pour votre message.',
      q.customer_name
    );
    openWhatsApp(q.customer_phone, message);

    // 2. Marquer comme répondue
    await api.markQuestionReplied(q.id, profile);
    loadDashboardData();
  };

  return (
    <div className="space-y-6">
      {/* En-tête Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900">
            Tableau de Bord
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Aperçu de la relation client et de la satisfaction gastronomique
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/questions"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Questions reçues ({pendingQuestions.length})</span>
          </Link>
        </div>
      </div>

      {/* Cartes d'Indicateurs Clés */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Avis */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Avis</span>
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-bold font-serif text-stone-900">
              {totalFeedback}
            </span>
            <span className="block text-[11px] text-stone-400 mt-1">Clients satisfaits</span>
          </div>
        </div>

        {/* Moyenne Générale */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Moyenne</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold font-serif text-amber-900">
                {averageRating}
              </span>
              <span className="text-xs text-stone-400">/ 5</span>
            </div>
            <span className="block text-[11px] text-stone-400 mt-1">Note globale</span>
          </div>
        </div>

        {/* Avis du Mois */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Avis du Mois</span>
            <Calendar className="w-4 h-4 text-stone-600" />
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-bold font-serif text-stone-900">
              {currentMonthFeedback}
            </span>
            <span className="block text-[11px] text-stone-400 mt-1">Mois en cours</span>
          </div>
        </div>

        {/* Questions Reçues (Non Répondues) */}
        <div
          className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
            pendingQuestions.length > 0
              ? 'bg-emerald-50/80 border-emerald-300'
              : 'bg-white border-stone-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-medium uppercase tracking-wider ${
                pendingQuestions.length > 0 ? 'text-emerald-900 font-bold' : 'text-stone-500'
              }`}
            >
              À Répondre
            </span>
            <MessageCircle
              className={`w-4 h-4 ${
                pendingQuestions.length > 0 ? 'text-emerald-600' : 'text-stone-400'
              }`}
            />
          </div>
          <div>
            <span
              className={`text-2xl sm:text-3xl font-bold font-serif ${
                pendingQuestions.length > 0 ? 'text-emerald-700' : 'text-stone-900'
              }`}
            >
              {pendingQuestions.length}
            </span>
            <span className="block text-[11px] text-stone-500 mt-1">WhatsApp en attente</span>
          </div>
        </div>

        {/* Avis Nécessitant Attention (Notes 1–2) */}
        <div
          className={`col-span-2 sm:col-span-1 p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
            alertFeedback.length > 0
              ? 'bg-rose-50 border-rose-300'
              : 'bg-white border-stone-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-medium uppercase tracking-wider ${
                alertFeedback.length > 0 ? 'text-rose-900 font-bold' : 'text-stone-500'
              }`}
            >
              Attention ⚠️
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                alertFeedback.length > 0 ? 'text-rose-600' : 'text-stone-400'
              }`}
            />
          </div>
          <div>
            <span
              className={`text-2xl sm:text-3xl font-bold font-serif ${
                alertFeedback.length > 0 ? 'text-rose-700' : 'text-stone-900'
              }`}
            >
              {alertFeedback.length}
            </span>
            <span className="block text-[11px] text-rose-700 mt-1">Notes 1–2 étoiles</span>
          </div>
        </div>
      </div>

      {/* Grille 2 Colonnes : Questions à traiter & Derniers Avis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne 1 : Questions Reçues (À traiter via WhatsApp) */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <h2 className="font-serif font-bold text-base text-stone-900">
                Questions non répondues
              </h2>
            </div>
            <Link
              to="/admin/questions"
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
            >
              <span>Voir tout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-stone-400">Chargement...</div>
          ) : pendingQuestions.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-stone-800">Toutes les questions sont traitées !</p>
              <p className="text-xs text-stone-400 mt-1">
                Aucune question client en attente de réponse.
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {pendingQuestions.slice(0, 3).map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <span className="font-semibold text-xs text-stone-900 block">
                        {q.customer_name}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        {q.customer_phone}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      REÇUE
                    </span>
                  </div>

                  <p className="text-xs text-stone-700 line-clamp-2 mb-3 bg-white p-2 rounded-xl border border-stone-200/80">
                    « {q.question} »
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(q.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {canReply ? (
                        <button
                          type="button"
                          onClick={() => handleQuickReply(q)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all active:scale-95 shadow-xs"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Répondre WhatsApp</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">
                          Lecture seule
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs transition-all active:scale-95"
                        title="Supprimer la question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colonne 2 : Derniers Avis Reçus */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>
              <h2 className="font-serif font-bold text-base text-stone-900">
                Derniers avis reçus
              </h2>
            </div>
            <Link
              to="/admin/feedback"
              className="text-xs text-amber-800 hover:text-amber-900 font-medium inline-flex items-center gap-1"
            >
              <span>Voir tout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-stone-400">Chargement...</div>
          ) : feedbackList.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-stone-800">Aucun avis pour l'instant</p>
              <p className="text-xs text-stone-400 mt-1">
                Les retours de vos clients apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {feedbackList.slice(0, 3).map((fb) => (
                <div
                  key={fb.id}
                  className={`p-3.5 rounded-2xl border transition-colors ${
                    fb.rating <= 2
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < fb.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-stone-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-stone-900">
                        {fb.customer_name || 'Client anonyme'}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        fb.rating <= 2
                          ? 'bg-rose-100 text-rose-800'
                          : fb.rating === 3
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {fb.rating <= 2
                        ? 'Attention ⚠️'
                        : fb.rating === 3
                        ? 'Normal'
                        : 'Positif ⭐'}
                    </span>
                  </div>

                  <p className="text-xs text-stone-700 line-clamp-2 mb-2 bg-white p-2 rounded-xl border border-stone-200/80">
                    « {fb.comment} »
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-stone-400">
                    <span className="font-medium text-stone-600">
                      {fb.service_name || 'Service'}
                    </span>
                    <span>
                      {new Date(fb.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
