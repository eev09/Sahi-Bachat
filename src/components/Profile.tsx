import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { LanguageSelector } from './LanguageSelector';
import { motion } from 'motion/react';
import { User, Phone, Globe, LogOut, ShieldCheck } from 'lucide-react';

export function Profile() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const handleLogout = async () => {
    try {
      localStorage.removeItem('demo_uid');
      window.location.reload();
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const updateLanguage = async (lang: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        language: lang
      });
      i18n.changeLanguage(lang);
    } catch (err) {
      console.error("Error updating language:", err);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <div className="text-center space-y-4">
        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg">
          <User className="w-12 h-12 text-orange-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{profile.name}</h2>
          <p className="text-gray-500 flex items-center justify-center gap-1">
            <Phone className="w-4 h-4" />
            {profile.phoneNumber}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-gray-700 font-bold mb-4">
            <Globe className="w-5 h-5 text-orange-600" />
            {t('select_language')}
          </div>
          <LanguageSelector onSelect={updateLanguage} />
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-gray-700 font-bold mb-4">
            <ShieldCheck className="w-5 h-5 text-orange-600" />
            {t('account_status')}
          </div>
          <div className="bg-green-50 text-green-700 p-4 rounded-2xl flex items-center gap-3 border border-green-100">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {t('verified_profile')}
          </div>
        </div>

        <div className="p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            {t('logout')}
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400">
        <p>{t('app_version')}</p>
        <p>{t('app_mission')}</p>
      </div>
    </div>
  );
}
