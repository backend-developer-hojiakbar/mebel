import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Contract, ContractDetails } from '../types';
import { extractTextFromFile } from '../utils/fileExtractor';
import { analyzeContract } from '../services/geminiService';

const LOCAL_STORAGE_KEY = 'tenderhunter-contracts';

interface KnowledgeBaseContextType {
  contracts: Contract[];
  addContracts: (files: File[]) => Promise<void>;
  removeContract: (id: string) => void;
  isLoading: boolean;
  getAggregatedContractsContent: () => string;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

export const KnowledgeBaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedContracts = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedContracts) {
        // Ensure old contracts without processing flag are handled
        const parsedContracts: Contract[] = JSON.parse(storedContracts);
        setContracts(parsedContracts.map(c => ({...c, processing: false})));
      }
    } catch (error) {
      console.error("Failed to load contracts from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Prevent saving contracts that are still processing to localStorage
    const contractsToSave = contracts.filter(c => !c.processing);
    if (contractsToSave.length > 0 || localStorage.getItem(LOCAL_STORAGE_KEY) !== null) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(contractsToSave));
      } catch (error) {
        console.error("Failed to save contracts to localStorage:", error);
      }
    }
  }, [contracts]);

  const addContracts = async (files: File[]) => {
    const newPlaceholders: Contract[] = [];
    
    // Create placeholders and add them to state immediately for UI feedback
    setContracts(prev => {
      const existingIds = new Set(prev.map(c => c.id));
      files.forEach(file => {
        const id = `${file.name}-${file.lastModified}`;
        if (!existingIds.has(id)) {
          newPlaceholders.push({
            id: id,
            fileName: file.name,
            content: '',
            processing: true
          });
          existingIds.add(id);
        }
      });
      return [...prev, ...newPlaceholders];
    });

    // Process each new placeholder
    newPlaceholders.forEach(async (placeholder) => {
        const file = files.find(f => `${f.name}-${f.lastModified}` === placeholder.id);
        if (!file) return;

        try {
            const content = await extractTextFromFile(file);
            const details: ContractDetails = await analyzeContract(content);

            // Update the specific contract with its content and details
            setContracts(prev =>
                prev.map(c =>
                    c.id === placeholder.id
                        ? { ...c, content, details, processing: false }
                        : c
                )
            );
        } catch (error) {
            console.error(`Failed to process contract ${placeholder.fileName}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis.';
            // Update the contract to show an error and stop processing
            setContracts(prev =>
                prev.map(c =>
                    c.id === placeholder.id
                        ? { ...c, details: { customer: 'Error', supplier: errorMessage, totalValue: 'Error', products: [] }, processing: false }
                        : c
                )
            );
        }
    });
  };


  const removeContract = (id: string) => {
    setContracts((prev) => prev.filter((contract) => contract.id !== id));
  };

  const getAggregatedContractsContent = useCallback((): string => {
    if (contracts.length === 0) {
      return '';
    }
    const knowledgeBaseEntries = contracts
      .filter(c => c.details && !c.processing && c.details.products.length > 0) // Only use fully analyzed contracts
      .flatMap(c => 
        c.details!.products.map(p => 
          `- Product: "${p.name}", Supplier: "${c.details!.supplier}", Unit Price: ${p.unitPrice}`
        )
      );

    if (knowledgeBaseEntries.length === 0) return '';
    
    return `Summary of past purchases based on our contracts:\n${knowledgeBaseEntries.join('\n')}`;
  }, [contracts]);

  return (
    <KnowledgeBaseContext.Provider value={{ contracts, addContracts, removeContract, isLoading, getAggregatedContractsContent }}>
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

export const useKnowledgeBase = () => {
  const context = useContext(KnowledgeBaseContext);
  if (context === undefined) {
    throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
  }
  return context;
};