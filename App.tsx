
import React, { useState, useCallback } from 'react';
import { AnalysisResult, AnalysisRequest, AnalysisProgress, AnalysisHistoryItem } from './types';
import NewAnalysisForm from './components/NewAnalysisForm';
import LoadingIndicator from './components/LoadingIndicator';
import ResultsDisplay from './components/ResultsDisplay';
import Header from './components/Header';
import { analyzeLot } from './services/geminiService';
import { I18nProvider, useTranslation } from './context/I18nContext';
import { KnowledgeBaseProvider, useKnowledgeBase } from './context/KnowledgeBaseContext';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import { AnalysisHistoryProvider, useAnalysisHistory } from './context/AnalysisHistoryContext';
import AnalysisHistoryManager from './components/AnalysisHistoryManager';
import DashboardManager from './components/DashboardManager';
import QuickSearchManager from './components/QuickSearchManager';

type AppState = 'form' | 'loading' | 'results' | 'error';
type AppView = 'dashboard' | 'analysis' | 'contracts' | 'history' | 'quickSearch';

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-bold transition-colors duration-200 relative outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:z-10 ${
      isActive ? 'text-teal-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    {label}
    {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-fuchsia-500 to-teal-500"></div>}
  </button>
);


const AppContent: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('form');
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const { t, locale } = useTranslation();
  const { getAggregatedContractsContent } = useKnowledgeBase();
  const { addAnalysisToHistory } = useAnalysisHistory();

  const handleStartAnalysis = useCallback(async (request: Omit<AnalysisRequest, 'uiLanguage'>) => {
    setAppState('loading');
    setCurrentView('analysis'); // Switch back to analysis view if starting from another tab
    setError(null);
    setAnalysisProgress(null);
    try {
      const fullRequest: AnalysisRequest = { ...request, uiLanguage: locale };
      const knowledgeBaseContent = getAggregatedContractsContent();
      const result = await analyzeLot(fullRequest, setAnalysisProgress, knowledgeBaseContent);
      setAnalysisResult(result);
      addAnalysisToHistory(result); // Save to history on success
      setAppState('results');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      setError(errorMessage);
      setAppState('error');
    }
  }, [locale, getAggregatedContractsContent, addAnalysisToHistory]);

  const handleCreateNewAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setError(null);
    setAnalysisProgress(null);
    setAppState('form');
  }, []);
  
  const handleViewHistoryItem = useCallback((item: AnalysisHistoryItem) => {
    setAnalysisResult(item.analysisResult);
    setAppState('results');
    setCurrentView('analysis');
  }, []);

  const renderContent = () => {
    switch (appState) {
      case 'loading':
        return <LoadingIndicator progress={analysisProgress} />;
      case 'results':
        return analysisResult && <ResultsDisplay result={analysisResult} onNewAnalysis={handleCreateNewAnalysis} getKnowledgeBaseContent={getAggregatedContractsContent} />;
      case 'error':
        return (
          <div className="text-center p-8 min-h-[500px] flex flex-col justify-center items-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">{t('error.title')}</h2>
            <p className="text-slate-300 mb-6 max-w-md">{t('error.genericMessage', { details: error })}</p>
            <button
              onClick={handleCreateNewAnalysis}
              className="bg-gradient-to-r from-teal-500 to-fuchsia-500 text-white font-semibold py-2 px-6 rounded-lg shadow-lg hover:from-teal-600 hover:to-fuchsia-600 transition-all"
            >
              {t('error.tryAgainButton')}
            </button>
          </div>
        );
      case 'form':
      default:
        return <NewAnalysisForm onStartAnalysis={handleStartAnalysis} />;
    }
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-teal-300/20">
      <div className="glow-effect"></div>
      <Header />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="bg-slate-900/50 rounded-2xl shadow-2xl overflow-hidden card-border-gradient">
          <div className="border-b border-slate-700/50 flex flex-wrap">
             <TabButton 
                label={t('app.tabs.dashboard')}
                isActive={currentView === 'dashboard'}
                onClick={() => setCurrentView('dashboard')}
              />
             <TabButton 
                label={t('app.tabs.analysis')}
                isActive={currentView === 'analysis'}
                onClick={() => setCurrentView('analysis')}
              />
              <TabButton 
                label={t('app.tabs.contracts')}
                isActive={currentView === 'contracts'}
                onClick={() => setCurrentView('contracts')}
              />
              <TabButton 
                label={t('app.tabs.history')}
                isActive={currentView === 'history'}
                onClick={() => setCurrentView('history')}
              />
              <TabButton 
                label={t('app.tabs.quickSearch')}
                isActive={currentView === 'quickSearch'}
                onClick={() => setCurrentView('quickSearch')}
              />
          </div>
          
          {currentView === 'dashboard' && <DashboardManager onViewHistoryItem={handleViewHistoryItem} />}
          {currentView === 'analysis' && renderContent()}
          {currentView === 'contracts' && <KnowledgeBaseManager />}
          {currentView === 'history' && <AnalysisHistoryManager onView={handleViewHistoryItem} />}
          {currentView === 'quickSearch' && <QuickSearchManager />}

        </div>
        <footer className="text-center mt-8 text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} TenderHunter AI. {t('footer.rights')}</p>
          <p className="mt-1 opacity-75">Powered by Google Gemini</p>
        </footer>
      </main>
    </div>
  );
};


const App: React.FC = () => {
  return (
    <I18nProvider>
      <KnowledgeBaseProvider>
        <AnalysisHistoryProvider>
          <AppContent />
        </AnalysisHistoryProvider>
      </KnowledgeBaseProvider>
    </I18nProvider>
  )
}

export default App;
