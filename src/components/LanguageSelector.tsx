import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

const languages = [
  { code: 'hi', name: 'हिन्दी', label: 'Hindi' },
  { code: 'en', name: 'English', label: 'English' },
  { code: 'ta', name: 'தமிழ்', label: 'Tamil' },
  { code: 'te', name: 'తెలుగు', label: 'Telugu' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', label: 'Punjabi' },
];

export function LanguageSelector({ className, onSelect }: { className?: string, onSelect?: (code: string) => void }) {
  const { i18n, t } = useTranslation();

  const handleSelect = (code: string) => {
    console.log("LanguageSelector: selecting", code);
    i18n.changeLanguage(code).then(() => {
      console.log("LanguageSelector: language changed to", i18n.language);
    });
    if (onSelect) onSelect(code);
  };

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-3", className)}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => handleSelect(lang.code)}
          className={cn(
            "px-4 py-3 rounded-2xl text-sm font-medium transition-all text-left flex flex-col justify-center min-h-[72px] relative overflow-hidden active:scale-95 touch-manipulation",
            i18n.language.startsWith(lang.code)
              ? "bg-orange-600 text-white shadow-lg shadow-orange-200 ring-2 ring-orange-600 ring-offset-2"
              : "bg-white text-gray-700 border border-gray-200 hover:border-orange-300 active:bg-orange-50"
          )}
        >
          <span className={cn(
            "block text-[10px] uppercase tracking-wider font-bold mb-0.5",
            i18n.language.startsWith(lang.code) ? "text-orange-100" : "text-gray-400"
          )}>{t(lang.code)}</span>
          <span className="block text-base font-bold leading-tight">{lang.name}</span>
          {i18n.language.startsWith(lang.code) && (
            <motion.div
              layoutId="active-lang"
              className="absolute right-2 top-2 w-2 h-2 bg-white rounded-full"
            />
          )}
        </button>
      ))}
    </div>
  );
}
