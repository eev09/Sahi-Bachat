import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { motion } from 'motion/react';
import { Phone, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function Auth({ onComplete }: { onComplete: () => void }) {
  const { t, i18n } = useTranslation();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setError(t('fill_all_fields', 'Please fill all fields'));
      return;
    }
    setStep('otp');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Auth handleSubmit triggered", { name, phone, otp });
    if (!otp) {
      setError(t('fill_all_fields', 'Please fill all fields'));
      return;
    }
    setError('');
    // Call signUp and wait for state updates
    console.log("Calling signUp...");
    signUp(name, phone, i18n.language || 'en').then(() => {
      console.log("signUp complete, calling onComplete...");
      onComplete();
    }).catch(err => {
      console.error("signUp error:", err);
      setError(t('signup_failed', 'Failed to sign up. Please try again.'));
    });
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-orange-100"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-800 mb-2">{t('welcome')}</h1>
          <p className="text-orange-600 opacity-80">{t('tagline')}</p>
        </div>

        {step === 'info' ? (
          <>
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('select_language')}</label>
              <LanguageSelector />
            </div>

            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                    placeholder={t('name_placeholder', 'Enter your name')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone_number')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                    placeholder={t('phone_placeholder', 'Enter your phone number')}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {t('get_started', 'Get Started')}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('enter_otp')}</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all tracking-[0.5em] text-center font-bold text-xl"
                  placeholder="000000"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">{t('otp_demo_hint', 'Enter any 6 digits to continue')}</p>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('info')}
                className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
              >
                {t('back', 'Back')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "..." : t('verify_otp', 'Verify & Enter')}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
