import React, { useEffect, useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Settings,
  Save,
  QrCode,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Database,
  Phone,
  MessageCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { api, DEFAULT_SETTINGS } from '../../lib/supabase';
import type { AppSettings, ServiceItem } from '../../types/database';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Nouvel ajout de service
  const [newServiceName, setNewServiceName] = useState('');
  const [addingService, setAddingService] = useState(false);

  // Statut connexion Supabase
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [testingDb, setTestingDb] = useState(false);

  // Ref pour le QR Code
  const qrRef = useRef<HTMLDivElement>(null);

  const feedbackUrl = `${window.location.origin}/feedback`;

  useEffect(() => {
    async function load() {
      try {
        const [loadedSettings, loadedServices, conn] = await Promise.all([
          api.getSettings(),
          api.getAllServices(),
          api.testConnection(),
        ]);
        setSettings(loadedSettings);
        setServices(loadedServices);
        setDbStatus(conn);
      } catch (err) {
        console.error('Erreur chargement paramètres:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setSuccessMsg('✓ Paramètres enregistrés et persistés dans Supabase avec succès !');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l’enregistrement des paramètres.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Sélectionner un logo par fichier image
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Le logo ne doit pas dépasser 5 Mo.');
      return;
    }

    setLogoUploading(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionner proprement à max 600px en préservant le PNG transparent
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setSettings((prev) => ({ ...prev, logo_url: dataUrl }));
        } else {
          setSettings((prev) => ({ ...prev, logo_url: event.target?.result as string }));
        }
        setLogoUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Gestion des services
  const handleToggleService = async (service: ServiceItem) => {
    try {
      const updated = await api.saveService({
        ...service,
        is_active: !service.is_active,
      });
      setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
    } catch (err: any) {
      setErrorMsg('Erreur lors de la mise à jour du service.');
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    setAddingService(true);
    try {
      const created = await api.saveService({
        name: newServiceName.trim(),
        is_active: true,
        sort_order: services.length + 1,
      });
      setServices((prev) => [...prev, created]);
      setNewServiceName('');
    } catch (err: any) {
      setErrorMsg('Impossible d’ajouter le service.');
    } finally {
      setAddingService(false);
    }
  };

  // Télécharger le QR code en PNG pour impression
  const downloadQRCode = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-avis-chef-sebastien.png`;
      a.click();
    }
  };

  const handleTestDatabase = async () => {
    setTestingDb(true);
    try {
      const conn = await api.testConnection();
      setDbStatus(conn);
    } finally {
      setTestingDb(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>Super Admin Uniquement</span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900">
            Paramètres Généraux
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Personnalisez les coordonnées WhatsApp, les modèles de messages et vos services
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grille 2 Colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire Principal des Paramètres (2 colonnes) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <Settings className="w-5 h-5 text-amber-700" />
              <h2 className="font-serif font-bold text-lg text-stone-900">
                Coordonnées & Textes du Restaurant
              </h2>
            </div>

            {/* Nom de l'établissement */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Nom de l'établissement
              </label>
              <input
                type="text"
                value={settings.business_name}
                onChange={(e) =>
                  setSettings({ ...settings, business_name: e.target.value })
                }
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Logo de l'établissement (Sélecteur d'image direct) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#faf4ea] border border-[#d9ccb6] space-y-3">
              <label className="block text-xs font-bold text-[#1f1612] uppercase tracking-wider">
                Logo de l'établissement
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Boîte d'aperçu du logo */}
                <div className="w-36 h-20 rounded-xl bg-white border border-[#d9ccb6] p-2 flex items-center justify-center flex-shrink-0 shadow-xs relative overflow-hidden">
                  <img
                    src={settings.logo_url || '/logo.png'}
                    alt="Aperçu du logo"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '/logo.png';
                    }}
                  />
                </div>

                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff0316] hover:bg-[#b8000f] text-[#faf4ea] text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{logoUploading ? 'Traitement...' : 'Choisir un nouveau logo'}</span>
                    </button>

                    {settings.logo_url && settings.logo_url !== '/logo.png' && (
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, logo_url: '' })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
                        title="Revenir au logo initial officiel"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Logo par défaut</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-[#6b5b51] leading-relaxed">
                    Formats acceptés : PNG transparent, JPG ou WebP (max 5 Mo). Le logo s'affichera immédiatement sur tout le site et l'espace de connexion.
                  </p>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Message d'accueil public */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Message d'accueil (Page d'accueil)
              </label>
              <textarea
                rows={2}
                value={settings.welcome_message}
                onChange={(e) =>
                  setSettings({ ...settings, welcome_message: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Paramètres WhatsApp Conseiller */}
            <div className="pt-2 border-t border-stone-100 space-y-4">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bouton « Parler à un conseiller »</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Numéro WhatsApp Conseiller (sans + ni espaces)
                  </label>
                  <input
                    type="text"
                    value={settings.whatsapp_number}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsapp_number: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    placeholder="50937000000"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Exemple Haïti : 50937000000</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Message prérempli pour le conseiller
                  </label>
                  <textarea
                    rows={2}
                    value={settings.support_message}
                    onChange={(e) =>
                      setSettings({ ...settings, support_message: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modèle de réponse aux questions */}
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Modèle de réponse automatique WhatsApp</span>
                </h3>
                <span className="text-[11px] text-stone-400">
                  Balise disponible : <code className="bg-stone-100 px-1 py-0.5 rounded font-mono font-bold text-amber-800">{'{prénom}'}</code>
                </span>
              </div>

              <textarea
                rows={2}
                value={settings.reply_template}
                onChange={(e) =>
                  setSettings({ ...settings, reply_template: e.target.value })
                }
                placeholder="Bonjour {prénom}, merci pour votre message."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Option Téléphone obligatoire pour les avis */}
            <div className="pt-3 border-t border-stone-100">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.feedback_phone_required}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      feedback_phone_required: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    Numéro de téléphone obligatoire pour soumettre un avis
                  </span>
                  <span className="text-[11px] text-stone-500">
                    Si coché, les clients doivent impérativement saisir leur numéro pour poster un avis.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
              </button>
            </div>
          </form>

          {/* Gestion des Services du Restaurant */}
          <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-xs space-y-4">
            <h2 className="font-serif font-bold text-lg text-stone-900 pb-2 border-b border-stone-100">
              Services proposés (utilisés dans le formulaire d'avis)
            </h2>

            <form onSubmit={handleAddService} className="flex gap-2">
              <input
                type="text"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Ex: Pâtisserie fine & Desserts événementiels"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={addingService || !newServiceName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </form>

            <div className="space-y-2 pt-2">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                >
                  <span className="font-semibold text-stone-900">{svc.name}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleService(svc)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      svc.is_active
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {svc.is_active ? 'Actif' : 'Désactivé'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne Latérale : QR Code & État Base de Données */}
        <div className="space-y-6">
          {/* Générateur et Téléchargement du QR Code */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs text-center">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="font-serif font-bold text-base text-stone-900 mb-1">
              QR Code pour Tables & Menus
            </h3>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              Vos convives scannent ce code avec leur smartphone pour donner leur avis instantanément.
            </p>

            <div
              ref={qrRef}
              className="bg-white p-4 rounded-2xl border border-stone-300 inline-block shadow-inner mb-4"
            >
              <QRCodeCanvas
                value={feedbackUrl}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <p className="text-[11px] font-mono text-stone-400 break-all mb-4 bg-stone-50 p-2 rounded-lg border border-stone-200">
              {feedbackUrl}
            </p>

            <button
              type="button"
              onClick={downloadQRCode}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le QR Code (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
