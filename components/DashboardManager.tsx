
import React, { useMemo } from 'react';
import { useTranslation } from '../context/I18nContext';
import { useAnalysisHistory } from '../context/AnalysisHistoryContext';
import { useKnowledgeBase } from '../context/KnowledgeBaseContext';
import { Card } from './ui/Card';
import { StatCard } from './ui/StatCard';
import { AnalysisHistoryItem } from '../types';

interface DashboardManagerProps {
    onViewHistoryItem: (item: AnalysisHistoryItem) => void;
}

const DashboardManager: React.FC<DashboardManagerProps> = ({ onViewHistoryItem }) => {
    const { t, locale } = useTranslation();
    const { history } = useAnalysisHistory();
    const { contracts } = useKnowledgeBase();
    
    const formatUzs = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(amount);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const totalAnalyses = history.length;
        const totalContracts = contracts.length;

        const wonCount = history.filter(h => h.status === 'won').length;
        const lostCount = history.filter(h => h.status === 'lost').length;
        const totalParticipated = wonCount + lostCount;
        const winRate = totalParticipated > 0 ? ((wonCount / totalParticipated) * 100).toFixed(1) + '%' : t('dashboard.kpi.noData');

        let totalSuppliersFound = 0;
        let totalProductsAnalyzed = 0;
        history.forEach(item => {
            item.analysisResult.products.forEach(product => {
                totalProductsAnalyzed++;
                totalSuppliersFound += product.suppliers.length;
            });
        });
        const avgSuppliers = totalProductsAnalyzed > 0 ? (totalSuppliersFound / totalProductsAnalyzed).toFixed(1) : "0";
        
        const wonTendersWithFinancials = history.filter(h => h.status === 'won' && h.winningBid && h.actualCost);
        const totalProfit = wonTendersWithFinancials.reduce((sum, item) => sum + ((item.winningBid || 0) - (item.actualCost || 0)), 0);
        const totalRevenue = wonTendersWithFinancials.reduce((sum, item) => sum + (item.winningBid || 0), 0);
        const avgMargin = totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : t('dashboard.kpi.noData');


        return { totalAnalyses, totalContracts, avgSuppliers, winRate, wonCount, lostCount, totalProfit: formatUzs(totalProfit), avgMargin };
    }, [history, contracts, t, formatUzs]);

    // Calculate chart data
    const chartData = useMemo(() => {
        const months: { name: string, count: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                name: date.toLocaleString(locale.split('-')[0], { month: 'short' }),
                count: 0
            });
        }

        history.forEach(item => {
            const itemDate = new Date(item.timestamp);
            const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            sixMonthsAgo.setHours(0, 0, 0, 0); // Start of the day
            if (itemDate >= sixMonthsAgo) {
                const monthIndex = 5 - ((now.getFullYear() - itemDate.getFullYear()) * 12 + (now.getMonth() - itemDate.getMonth()));
                if (monthIndex >= 0 && monthIndex < 6) {
                    months[monthIndex].count++;
                }
            }
        });

        const maxCount = Math.max(1, ...months.map(m => m.count)); // Avoid division by zero
        return months.map(month => ({ ...month, height: `${(month.count / maxCount) * 100}%` }));

    }, [history, locale]);
    
    const recentAnalyses = history.slice(0, 3);
    const recentContracts = contracts.filter(c => !c.processing).slice(0, 3);


    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>
                    {t('dashboard.title')}
                </h2>
                <p className="text-slate-400 mt-2 max-w-2xl mx-auto">{t('dashboard.subtitle')}</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard label={t('dashboard.kpi.totalProfit')} value={kpis.totalProfit} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                 <StatCard label={t('dashboard.kpi.avgMargin')} value={kpis.avgMargin} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                 <StatCard label={t('dashboard.kpi.winRate')} value={kpis.winRate} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>} />
                 <StatCard label={t('dashboard.kpi.totalAnalyses')} value={kpis.totalAnalyses} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart */}
                <Card className="p-6 lg:col-span-2">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">{t('dashboard.chart.title')}</h3>
                    <div className="h-64 flex items-end justify-around gap-2 p-4 bg-slate-800/30 rounded-lg">
                        {chartData.map((month, index) => (
                            <div key={index} className="flex flex-col items-center w-full group">
                                <div className="w-full h-full flex items-end">
                                    <div 
                                        className="w-full bg-gradient-to-t from-teal-500/50 to-teal-400/80 rounded-t-md group-hover:from-teal-500 group-hover:to-teal-400 transition-all duration-300 relative" 
                                        style={{ height: month.height }}
                                    >
                                     <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">{month.count}</span>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 mt-2">{month.name}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Recent Activity */}
                <div className="space-y-6">
                    <Card className="p-4">
                        <h3 className="text-lg font-semibold text-slate-200 mb-3">{t('dashboard.recent.analyses')}</h3>
                        <ul className="space-y-2">
                           {recentAnalyses.length > 0 ? recentAnalyses.map(item => (
                               <li key={item.analysisResult.lotId}>
                                   <button onClick={() => onViewHistoryItem(item)} className="w-full text-left bg-slate-800/50 hover:bg-slate-800/80 p-3 rounded-lg border border-slate-700/50 transition-colors">
                                       <p className="text-sm font-semibold text-slate-200 truncate">{item.analysisResult.sourceIdentifier}</p>
                                       <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleDateString(locale)}</p>
                                   </button>
                               </li>
                           )) : <p className="text-sm text-center py-4 text-slate-500">{t('dashboard.kpi.noData')}</p>}
                        </ul>
                    </Card>
                     <Card className="p-4">
                        <h3 className="text-lg font-semibold text-slate-200 mb-3">{t('dashboard.recent.contracts')}</h3>
                         <ul className="space-y-2">
                            {recentContracts.length > 0 ? recentContracts.map(item => (
                                <li key={item.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                    <p className="text-sm font-semibold text-slate-200 truncate">{item.fileName}</p>
                                    <p className="text-xs text-slate-400 truncate">{item.details?.supplier || '...'}</p>
                                </li>
                            )) : <p className="text-sm text-center py-4 text-slate-500">{t('dashboard.kpi.noData')}</p>}
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardManager;