import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Camera,
  Trash2,
} from 'lucide-react';
import { api, DEFAULT_SETTINGS } from '../../lib/supabase';
import { StarRating } from '../../components/common/StarRating';
import { normalizeHaitiPhone } from '../../lib/whatsapp';
import type { AppSettings, ServiceItem } from '../../types/database';

export const FeedbackPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Form state
  const [rating, setRating] = useState<number>(0);
  const [serviceId, setServiceId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState<boolean>(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [loadedSettings, loadedServices] = await Promise.all([
          api.getSettings(),
          api.getActiveServices(),
        ]);
        setSettings(loadedSettings);
        setServices(loadedServices);
        if (loadedServices.length > 0) {
          setServiceId(loadedServices[0].id);
        }
      } catch (err) {
        console.error('Erreur chargement formulaire avis:', err);
      } finally {
        setLoadingServices(false);
      }
    }
    loadData();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('La taille de la photo ne doit pas dépasser 8 Mo.');
      return;
    }

    setImageUploading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionner et compresser intelligemment pour préserver performance
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1000;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setImagePreview(dataUrl);
        } else {
          setImagePreview(event.target?.result as string);
        }
        setImageUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation de la note
    if (!rating || rating < 1 || rating > 5) {
      setErrorMessage('Veuillez sélectionner une note de 1 à 5 étoiles.');
      return;
    }

    // 2. Validation du service
    if (!serviceId) {
      setErrorMessage('Veuillez sélectionner le service concerné.');
      return;
    }

    // 3. Validation du commentaire
    if (!comment.trim()) {
      setErrorMessage('Veuillez écrire un commentaire sur votre expérience.');
      return;
    }

    // 4. Validation de la photo justificative (obligatoire)
    if (!imagePreview) {
      setErrorMessage('Veuillez ajouter une image pour que vous puissiez donner votre avis.');
      return;
    }

    // 5. Validation du téléphone si obligatoire ou renseigné
    let formattedPhone: string | undefined = undefined;
    if (customerPhone.trim()) {
      const phoneValidation = normalizeHaitiPhone(customerPhone);
      if (!phoneValidation.isValid) {
        setErrorMessage(phoneValidation.error || 'Numéro de téléphone invalide.');
        return;
      }
      formattedPhone = phoneValidation.normalized;
    } else if (settings.feedback_phone_required) {
      setErrorMessage('Le numéro de téléphone est requis par le restaurant.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.submitFeedback({
        rating,
        service_id: serviceId,
        comment: comment.trim(),
        customer_name: customerName.trim() || undefined,
        customer_phone: formattedPhone,
        image_url: imagePreview || undefined,
      });

      if (res.success) {
        setSubmitted(true);
        try {
          confetti({
            particleCount: 60,
            spread: 55,
            origin: { y: 0.6 },
            colors: ['#ff0316', '#b8000f', '#1f1612', '#d9ccb6'],
          });
        } catch {}
      } else {
        setErrorMessage(res.error || 'Une erreur est survenue lors de l’envoi de votre avis.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible d’enregistrer votre avis pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Écran de succès
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full px-5 py-8 text-center animate-in fade-in duration-200">
        <div className="bg-[#faf4ea] rounded-2xl p-6 sm:p-8 border border-[#1f1612] shadow-[4px_4px_0_#1f1612]">
          <div className="w-14 h-14 rounded-full bg-[#ffe3e5] text-[#b8000f] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="font-fraunces font-bold text-2xl sm:text-3xl text-[#1f1612] mb-3">
            Avis bien reçu !
          </h2>

          <div className="bg-white/80 border border-[#d9ccb6] rounded-xl p-4 text-[#1f1612] text-sm leading-relaxed mb-6 font-normal">
            « Merci pour votre avis ! Votre feedback a bien été enregistré. Il nous aide à améliorer continuellement nos services. »
          </div>

          <div className="space-y-3">
            <Link
              to="/"
              className="btn-tampon w-full h-12 bg-[#ff0316] text-[#faf4ea] rounded-[10px] flex items-center justify-center font-semibold text-base no-underline"
            >
              Retour à l’accueil
            </Link>

            <Link
              to="/question"
              className="btn-outline w-full h-12 bg-transparent text-[#1f1612] rounded-[10px] flex items-center justify-center gap-2 text-sm font-medium no-underline"
            >
              <MessageCircle className="w-4 h-4 text-[#b8000f]" />
              <span>Une question pour l'équipe ?</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-lg mx-auto w-full px-5 py-6">
      {/* Lien Retour */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-mono-custom text-[#6b5b51] hover:text-[#b8000f] mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Retour</span>
      </Link>

      <div className="bg-[#faf4ea] rounded-2xl p-6 sm:p-7 border border-[#1f1612] shadow-[4px_4px_0_#1f1612]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 font-mono-custom text-[10.5px] uppercase tracking-wider text-[#6b5b51] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff0316]"></span>
            <span>Avis Client · Delmas 54</span>
          </div>
          <h1 className="font-fraunces font-bold text-2xl sm:text-3xl text-[#1f1612]">
            Donner mon avis
          </h1>
          <p className="text-sm text-[#6b5b51] mt-1">
            Partagez votre expérience avec le Chef Sébastien
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-[#ffe3e5] border border-[#ff0316]/40 text-[#b8000f] text-xs">
            <AlertCircle className="w-4 h-4 text-[#b8000f] flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Note 1 à 5 étoiles (Obligatoire) */}
          <div className="bg-white/70 rounded-xl p-4 border border-[#d9ccb6] text-center">
            <label className="block font-mono-custom text-[11px] font-semibold text-[#6b5b51] uppercase tracking-wider mb-2">
              Votre note globale <span className="text-[#ff0316]">*</span>
            </label>
            <StarRating
              value={rating}
              onChange={setRating}
              size="lg"
              showLabel={true}
            />
          </div>

          {/* Service concerné (Obligatoire) */}
          <div>
            <label
              htmlFor="service"
              className="block font-mono-custom text-[11px] font-semibold text-[#6b5b51] uppercase tracking-wider mb-1.5"
            >
              Service concerné <span className="text-[#ff0316]">*</span>
            </label>
            {loadingServices ? (
              <div className="h-11 rounded-lg bg-stone-200/60 animate-pulse" />
            ) : (
              <select
                id="service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
                className="w-full px-3.5 py-3 rounded-[10px] border border-[#d9ccb6] bg-white text-[#1f1612] text-sm focus:outline-hidden focus:border-[#ff0316] focus:ring-1 focus:ring-[#ff0316]"
              >
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Commentaire (Obligatoire) */}
          <div>
            <label
              htmlFor="comment"
              className="block font-mono-custom text-[11px] font-semibold text-[#6b5b51] uppercase tracking-wider mb-1.5"
            >
              Votre commentaire <span className="text-[#ff0316]">*</span>
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              placeholder="Dites-nous ce qui vous a plu ou ce que nous pouvons perfectionner..."
              className="w-full px-3.5 py-3 rounded-[10px] border border-[#d9ccb6] bg-white text-[#1f1612] text-sm focus:outline-hidden focus:border-[#ff0316] focus:ring-1 focus:ring-[#ff0316] resize-none"
            />
          </div>

          {/* Photo justificative (Obligatoire) */}
          <div>
            <label className="block font-mono-custom text-[11px] font-semibold text-[#6b5b51] uppercase tracking-wider mb-1.5">
              Photo justificative <span className="text-[#ff0316]">*</span>{' '}
              <span className="text-[#b8000f] font-normal lowercase">(obligatoire — plat, ticket, reçu)</span>
            </label>

            {imagePreview ? (
              <div className="relative rounded-xl border border-[#d9ccb6] bg-white p-3 flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Aperçu photo justificative"
                  className="w-16 h-16 rounded-lg object-cover border border-[#d9ccb6] flex-shrink-0"
                />
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-xs font-semibold text-[#1f1612] block truncate">
                    Photo ajoutée à l'avis
                  </span>
                  <span className="text-[11px] text-emerald-700 font-mono-custom flex items-center gap-1 mt-0.5">
                    ✓ Justificatif prêt à être envoyé
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="p-2 rounded-lg text-[#6b5b51] hover:text-[#b8000f] hover:bg-[#ffe3e5] transition-colors"
                  title="Supprimer cette photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#d9ccb6] hover:border-[#ff0316] rounded-xl bg-white/70 hover:bg-white cursor-pointer transition-all text-center group">
                <Camera className="w-6 h-6 text-[#6b5b51] group-hover:text-[#ff0316] mb-1.5 transition-colors" />
                <span className="text-xs font-semibold text-[#1f1612]">
                  {imageUploading ? 'Traitement de la photo...' : 'Ajouter une image pour que vous puissiez donner votre avis'}
                </span>
                <span className="text-[11px] text-[#6b5b51] mt-0.5 font-mono-custom">
                  Requis : plat, ticket ou reçu (PNG, JPG)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Votre Nom (Facultatif) */}
          <div>
            <label
              htmlFor="customerName"
              className="block font-mono-custom text-[11px] font-semibold text-[#6b5b51] uppercase tracking-wider mb-1.5"
            >
              Votre nom <span className="text-stone-400 font-normal lowercase">(facultatif)</span>
            </label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Jean-Marc Desrosiers"
              className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#d9ccb6] bg-white text-[#1f1612] text-sm focus:outline-hidden focus:border-[#ff0316] focus:ring-1 focus:ring-[#ff0316]"
            />
          </div>

          {/* Téléphone / WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="customerPhone"
                className="block font-mono-custom text-[11px] font-semibold text-[#6b5b51] uppercase tracking-wider"
              >
                Numéro WhatsApp / Téléphone{' '}
                {settings.feedback_phone_required ? (
                  <span className="text-[#ff0316]">*</span>
                ) : (
                  <span className="text-stone-400 font-normal lowercase">(facultatif)</span>
                )}
              </label>
              <span className="font-mono-custom text-[10px] text-[#6b5b51]">Haïti : +509</span>
            </div>
            <input
              type="tel"
              id="customerPhone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ex: 3700 0000"
              required={settings.feedback_phone_required}
              className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#d9ccb6] bg-white text-[#1f1612] text-sm focus:outline-hidden focus:border-[#ff0316] focus:ring-1 focus:ring-[#ff0316]"
            />
          </div>

          {/* Bouton d'envoi tampon */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-tampon w-full h-13 mt-3 bg-[#ff0316] text-[#faf4ea] rounded-[10px] flex items-center justify-center gap-2 font-semibold text-base transition-all disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <span>Envoi en cours...</span>
            ) : (
              <span>Envoyer mon avis</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
