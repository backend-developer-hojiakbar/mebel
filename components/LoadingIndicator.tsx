
import React from 'react';
import { useTranslation } from '../context/I18nContext';
import { AnalysisProgress } from '../types';

interface LoadingIndicatorProps {
  progress: AnalysisProgress | null;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ progress }) => {
  const { t } = useTranslation();

  const getMessage = () => {
    if (!progress) {
      return t('loading.stage.starting');
    }
    switch (progress.stage) {
      case 'scraping':
        return t('loading.stage.scraping');
      case 'extracting':
        return t('loading.stage.extracting');
      case 'searching':
        return t('loading.stage.searching', { current: progress.current, total: progress.total });
      case 'summarizing':
        return t('loading.stage.summarizing');
      case 'done':
        return t('loading.stage.compiling');
      default:
        return t('loading.title');
    }
  };

  const progressPercentage = progress && progress.stage === 'searching' && progress.total > 0
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <div className="flex flex-col items-center justify-center p-16 min-h-[500px]">
      <div className="relative w-28 h-28">
        <div className="absolute inset-0 border-2 border-teal-400/30 rounded-full animate-[spin_4s_linear_infinite]"></div>
        <div className="absolute inset-2 border-t-2 border-fuchsia-400/80 rounded-full animate-[spin_2s_ease-in-out_infinite]"></div>
        <div className="absolute inset-4 border-b-2 border-teal-400/80 rounded-full animate-[spin_3s_ease-in-out_infinite_reverse]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-1 bg-teal-400/20 animate-[spin_2s_linear_infinite] [clip-path:polygon(0%_0%,50%_0%,50%_100%,0%_100%)]"></div>
        <div className="absolute w-full h-full flex items-center justify-center">
          <div className="w-4 h-4 bg-teal-300 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.8)]"></div>
        </div>
      </div>
      <h2 className="text-2xl font-semibold text-slate-200 mt-10" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>
        {t('loading.title')}
      </h2>
      <p className="text-slate-400 mt-2 text-center transition-opacity duration-500 h-6">
        {getMessage()}
      </p>
      {progress && progress.stage === 'searching' && (
        <div className="w-full max-w-sm bg-slate-700/50 rounded-full h-2.5 mt-4">
          <div
            className="bg-gradient-to-r from-teal-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default LoadingIndicator;