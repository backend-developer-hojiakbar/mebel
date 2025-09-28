import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

export type Locale = 'uz' | 'uz-Cyrl' | 'ru';
type Translations = Record<string, any>; // Can be nested

// In-memory cache for translations to avoid re-fetching
const translationsCache: Partial<Record<Locale, Translations>> = {};

// Helper to access nested keys like "form.title"
const getNestedTranslation = (translations: Translations, key: string): string | undefined => {
    return key.split('.').reduce((obj: any, k: string) => {
        return obj && obj[k];
    }, translations) as string | undefined;
}


interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const savedLocale = localStorage.getItem('locale');
      return (savedLocale && ['uz', 'uz-Cyrl', 'ru'].includes(savedLocale)) ? (savedLocale as Locale) : 'uz';
    } catch (e) {
      console.error("Could not access localStorage:", e);
      return 'uz';
    }
  });

  const [translations, setTranslations] = useState<Translations>(translationsCache[locale] || {});

  useEffect(() => {
    const fetchTranslations = async (lang: Locale) => {
      // Use cached version if available
      if (translationsCache[lang]) {
          setTranslations(translationsCache[lang]);
          return;
      }
      // Otherwise, fetch from server
      try {
          // Assuming the i18n folder is served at the root
          const response = await fetch(`/i18n/locales/${lang}.json`);
          if (!response.ok) {
              throw new Error(`Failed to load translation file for ${lang}`);
          }
          const data = await response.json();
          translationsCache[lang] = data; // Cache the fetched data
          setTranslations(data);
      } catch (error) {
          console.error(error);
          setTranslations({}); // Fallback to empty translations on error
      }
    };

    fetchTranslations(locale);
    document.documentElement.lang = locale.split('-')[0];
  }, [locale]);


  const setLocale = (newLocale: Locale) => {
    try {
      localStorage.setItem('locale', newLocale);
    } catch (e) {
      console.error("Failed to save locale to localStorage", e);
    }
    setLocaleState(newLocale);
  };

  const t = useCallback((key: string, replacements: Record<string, string | number> = {}): string => {
    // Return key if translations are not loaded yet
    if (Object.keys(translations).length === 0) {
        return key;
    }
    
    let translation = getNestedTranslation(translations, key) || key;
    
    Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`{{${placeholder}}}`, 'g');
        translation = translation.replace(regex, String(replacements[placeholder]));
    });

    return translation;
  }, [translations]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
