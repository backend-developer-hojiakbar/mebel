
import React, { useState } from 'react';
import { useTranslation } from '../context/I18nContext';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { performQuickSearch } from '../services/geminiService';
import { QuickSearchResult } from '../types';

const QuickSearchManager: React.FC = () => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<QuickSearchResult[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const searchResults = await performQuickSearch(query);
            setResults(searchResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('quickSearch.error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    const PriceDisplay: React.FC<{ price: string | null }> = ({ price }) => {
        if (price === 'Fetch Failed' || price === 'Analysis Failed') {
             return <span className="font-mono text-xs text-red-400">{t('quickSearch.priceError')}</span>;
        }
        if (price) {
            return <span className="font-semibold text-teal-300">{price}</span>;
        }
        return <span className="font-mono text-xs text-slate-500">{t('quickSearch.priceNA')}</span>;
    };

    const PhoneDisplay: React.FC<{ phone: string | null }> = ({ phone }) => {
        if (phone && phone !== 'N/A' && phone !== 'Analysis Failed' && phone !== 'Fetch Failed') {
            return (
                <>
                    <p className="text-sm font-medium text-slate-400 mt-2">{t('quickSearch.phone')}</p>
                    <span className="font-semibold text-slate-200">{phone}</span>
                </>
            );
        }
        return null;
    };


    return (
        <div className="p-8 space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>
                    {t('quickSearch.title')}
                </h2>
                <p className="text-slate-400 mt-2 max-w-2xl mx-auto">{t('quickSearch.subtitle')}</p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="w-full">
                        <Input
                            label=""
                            id="quick-search-query"
                            type="text"
                            placeholder={t('quickSearch.placeholder')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <Button type="submit" disabled={isLoading || !query.trim()} className="w-full sm:w-auto flex-shrink-0">
                         {isLoading ? t('quickSearch.loading') : t('quickSearch.button')}
                    </Button>
                </form>
            </Card>

            {isLoading && (
                <div className="text-center py-10">
                     <svg className="animate-spin h-8 w-8 text-teal-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-slate-300">{t('quickSearch.loading')}</p>
                </div>
            )}
            
            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {results && results.length === 0 && !isLoading && (
                 <p className="text-slate-500 text-center py-8">{t('quickSearch.noResults')}</p>
            )}

            {results && results.length > 0 && (
                <div className="space-y-4">
                    {results.map((result) => (
                        <Card key={result.id} className="p-4">
                           <div className="flex flex-col sm:flex-row justify-between gap-4">
                                <div className="flex-grow">
                                    <a 
                                        href={result.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-lg font-semibold text-slate-200 hover:text-teal-300 hover:underline"
                                    >
                                        {result.title}
                                    </a>
                                    <p className="text-sm text-slate-400 mt-1">{result.snippet}</p>
                                    <p className="text-xs text-slate-500 mt-2 truncate">{result.link}</p>
                                </div>
                                <div className="flex-shrink-0 text-left sm:text-right bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 w-full sm:w-48">
                                    <p className="text-sm font-medium text-slate-400">{t('quickSearch.price')}</p>
                                    <PriceDisplay price={result.price} />
                                    <PhoneDisplay phone={result.phone} />
                                </div>
                           </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuickSearchManager;