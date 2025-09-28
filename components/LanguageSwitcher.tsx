import React from 'react';
import { useTranslation, Locale } from '../context/I18nContext';

const LanguageSwitcher: React.FC = () => {
    const { locale, setLocale } = useTranslation();

    const languages: { code: Locale, label: string }[] = [
        { code: 'uz', label: "O'zb" },
        { code: 'uz-Cyrl', label: 'Ўзб' },
        { code: 'ru', label: 'Рус' }
    ];

    return (
        <div className="flex items-center space-x-1 bg-slate-800/50 p-1 rounded-full border border-slate-700">
            {languages.map(lang => (
                <button
                    key={lang.code}
                    onClick={() => setLocale(lang.code)}
                    className={`relative px-3 py-1 text-sm font-semibold rounded-full transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                        locale === lang.code
                            ? 'text-white'
                            : 'text-slate-300 hover:text-white'
                    }`}
                >
                    {locale === lang.code && (
                        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-500 to-fuchsia-600 shadow-md"></span>
                    )}
                    <span className="relative z-10">{lang.label}</span>
                </button>
            ))}
        </div>
    );
};

export default LanguageSwitcher;