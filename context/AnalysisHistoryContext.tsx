
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { AnalysisResult, AnalysisHistoryItem, AnalysisStatus } from '../types';

const LOCAL_STORAGE_KEY = 'tenderhunter-analysis-history';

interface AnalysisHistoryContextType {
  history: AnalysisHistoryItem[];
  addAnalysisToHistory: (result: AnalysisResult) => void;
  removeAnalysisFromHistory: (lotId: string) => void;
  updateAnalysisStatus: (lotId: string, status: AnalysisStatus) => void;
  updateAnalysisDetails: (lotId: string, details: Partial<Pick<AnalysisHistoryItem, 'winningBid' | 'actualCost' | 'deliveryNotes'>>) => void;
  isLoading: boolean;
}

const AnalysisHistoryContext = createContext<AnalysisHistoryContextType | undefined>(undefined);

export const AnalysisHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedHistory) {
        // Ensure old items have a default status
        const parsedHistory: AnalysisHistoryItem[] = JSON.parse(storedHistory);
        setHistory(parsedHistory.map(item => ({ ...item, status: item.status || 'pending' })));
      }
    } catch (error) {
      console.error("Failed to load analysis history from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
      } catch (error) {
        console.error("Failed to save analysis history to localStorage:", error);
      }
    }
  }, [history, isLoading]);

  const addAnalysisToHistory = useCallback((result: AnalysisResult) => {
    const newItem: AnalysisHistoryItem = {
      analysisResult: result,
      timestamp: Date.now(),
      status: 'pending'
    };
    // Add to the beginning of the list and remove duplicates by lotId
    setHistory(prev => [newItem, ...prev.filter(item => item.analysisResult.lotId !== result.lotId)]);
  }, []);

  const removeAnalysisFromHistory = useCallback((lotId: string) => {
    setHistory(prev => prev.filter(item => item.analysisResult.lotId !== lotId));
  }, []);

  const updateAnalysisStatus = useCallback((lotId: string, status: AnalysisStatus) => {
    setHistory(prev => prev.map(item => 
        item.analysisResult.lotId === lotId ? { ...item, status } : item
    ));
  }, []);

  const updateAnalysisDetails = useCallback((lotId: string, details: Partial<Pick<AnalysisHistoryItem, 'winningBid' | 'actualCost' | 'deliveryNotes'>>) => {
    setHistory(prev => prev.map(item =>
        item.analysisResult.lotId === lotId ? { ...item, ...details } : item
    ));
  }, []);


  return (
    <AnalysisHistoryContext.Provider value={{ history, addAnalysisToHistory, removeAnalysisFromHistory, updateAnalysisStatus, updateAnalysisDetails, isLoading }}>
      {children}
    </AnalysisHistoryContext.Provider>
  );
};

export const useAnalysisHistory = () => {
  const context = useContext(AnalysisHistoryContext);
  if (context === undefined) {
    throw new Error('useAnalysisHistory must be used within an AnalysisHistoryProvider');
  }
  return context;
};