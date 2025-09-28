import React from 'react';
import { useTranslation } from '../context/I18nContext';
import LanguageSwitcher from './LanguageSwitcher';

const Header: React.FC = () => {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-50 bg-slate-950/70 backdrop-blur-lg border-b border-teal-400/10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-teal-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <g style={{ filter: "url(#glow)" }}>
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10"/>
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10"/>
              <path d="M12 2v2M12 20v2M22 12h-2M4 12H2M4.93 4.93l1.414 1.414M17.66 17.66l1.414 1.414M19.07 4.93l-1.414 1.414M6.34 17.66l-1.414 1.414" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round"/>
            </g>
          </svg>
          <h1 className="text-2xl font-bold text-slate-100" style={{ textShadow: '0 0 8px rgba(20, 184, 166, 0.4)'}}>
            {t('header.title')}<span className="text-teal-400">{t('header.subtitle')}</span>
          </h1>
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
};

export default Header;