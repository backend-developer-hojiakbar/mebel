
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '../context/I18nContext';
import { useAnalysisHistory } from '../context/AnalysisHistoryContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { AnalysisHistoryItem, PotentialScore, AnalysisStatus } from '../types';

interface AnalysisHistoryManagerProps {
    onView: (item: AnalysisHistoryItem) => void;
}

const StatusSelector: React.FC<{ currentStatus: AnalysisStatus, onUpdate: (status: AnalysisStatus) => void }> = ({ currentStatus, onUpdate }) => {
    const { t } = useTranslation();
    const statuses: { value: AnalysisStatus, labelKey: string }[] = [
        { value: 'pending', labelKey: 'analysisHistory.status.pending' },
        { value: 'won', labelKey: 'analysisHistory.status.won' },
        { value: 'lost', labelKey: 'analysisHistory.status.lost' },
        { value: 'no_bid', labelKey: 'analysisHistory.status.noBid' },
    ];

    const statusColors: Record<AnalysisStatus, string> = {
        pending: 'bg-slate-600/50 text-slate-300 border-slate-500',
        won: 'bg-green-500/20 text-green-300 border-green-500',
        lost: 'bg-red-500/20 text-red-300 border-red-500',
        no_bid: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
    };

    return (
        <div className="flex items-center gap-2">
            <select
                value={currentStatus}
                onChange={(e) => onUpdate(e.target.value as AnalysisStatus)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-semibold rounded-md border py-1 pl-2 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors ${statusColors[currentStatus]}`}
            >
                {statuses.map(s => (
                    <option key={s.value} value={s.value} className="bg-slate-800 text-slate-200 font-semibold">{t(s.labelKey)}</option>
                ))}
            </select>
        </div>
    );
}

const PotentialScoreDisplay: React.FC<{ data: PotentialScore }> = ({ data }) => {
    const { t } = useTranslation();

    const scoreColorClass = useMemo(() => {
        if (data.potentialScore >= 75) return 'border-teal-400';
        if (data.potentialScore >= 50) return 'border-yellow-400';
        return 'border-red-400';
    }, [data.potentialScore]);
    
    const daysRemainingText = () => {
        if (data.daysRemaining < 0) return t('potentialScore.deadlineNA');
        if (data.daysRemaining === 0) return t('potentialScore.deadlineExpired');
        return t('potentialScore.daysRemaining', { days: data.daysRemaining });
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex justify-between items-start">
                <div className="space-y-1 text-sm">
                    <h4 className="font-bold text-slate-100">{t('potentialScore.title')}</h4>
                    <p className="text-xs text-slate-400 max-w-xs">{t('potentialScore.description')}</p>
                    <div className="pt-2 text-slate-300">
                        <p><span className="font-semibold text-green-400">{t('potentialScore.opportunity')}:</span> {data.opportunity} / 100</p>
                        <p><span className="font-semibold text-red-400">{t('potentialScore.risk')}:</span> {data.risk} / 100</p>
                        <p><span className="font-semibold text-teal-300">{t('potentialScore.winProbability')}:</span> {data.winProbability}%</p>
                    </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                    <div className={`w-20 h-20 rounded-full border-4 ${scoreColorClass} flex items-center justify-center bg-slate-900/50`}>
                        <span className="text-3xl font-bold text-slate-100">{data.potentialScore}</span>
                    </div>
                </div>
            </div>
            <div className="text-fuchsia-400 font-bold text-base pt-3 flex items-center">
                 <span className="text-xl mr-2 font-mono">&lt;</span>
                 {daysRemainingText()}
            </div>
        </div>
    );
};

const WonTenderDetails: React.FC<{ item: AnalysisHistoryItem }> = ({ item }) => {
    const { t } = useTranslation();
    const { updateAnalysisDetails } = useAnalysisHistory();
    const [isEditing, setIsEditing] = useState(false);
    const [details, setDetails] = useState({
        winningBid: item.winningBid || 0,
        actualCost: item.actualCost || 0,
        deliveryNotes: item.deliveryNotes || ''
    });

    useEffect(() => {
        // Automatically enter edit mode if essential data is missing for a 'won' tender
        if (!item.winningBid || !item.actualCost) {
            setIsEditing(true);
        }
    }, [item.winningBid, item.actualCost]);

    const handleSave = () => {
        updateAnalysisDetails(item.analysisResult.lotId, {
            winningBid: details.winningBid,
            actualCost: details.actualCost,
            deliveryNotes: details.deliveryNotes
        });
        setIsEditing(false);
    };
    
    const profit = (item.winningBid || 0) - (item.actualCost || 0);
    const margin = (item.winningBid && item.winningBid > 0) ? (profit / item.winningBid * 100).toFixed(1) : 0;
    const formatUzs = (amount: number) => new Intl.NumberFormat('ru-RU').format(amount);

    if (isEditing) {
        return (
             <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                         <label className="text-xs font-semibold text-slate-400">{t('analysisHistory.winningBid')}</label>
                         <input type="number" value={details.winningBid} onChange={(e) => setDetails(d => ({...d, winningBid: parseFloat(e.target.value) || 0}))} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200" />
                     </div>
                      <div>
                         <label className="text-xs font-semibold text-slate-400">{t('analysisHistory.actualCost')}</label>
                         <input type="number" value={details.actualCost} onChange={(e) => setDetails(d => ({...d, actualCost: parseFloat(e.target.value) || 0}))} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200" />
                     </div>
                 </div>
                 <div>
                     <label className="text-xs font-semibold text-slate-400">{t('analysisHistory.deliveryNotes')}</label>
                     <textarea value={details.deliveryNotes} onChange={(e) => setDetails(d => ({...d, deliveryNotes: e.target.value}))} rows={3} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200"></textarea>
                 </div>
                 <div className="text-right">
                     <Button onClick={handleSave} className="py-1.5 px-4 text-sm">{t('analysisHistory.saveDetails')}</Button>
                 </div>
             </div>
        )
    }

    return (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex justify-between items-center">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm w-full">
                    <div>
                        <p className="text-slate-400">{t('analysisHistory.winningBid')}</p>
                        <p className="font-bold text-slate-100">{formatUzs(item.winningBid || 0)}</p>
                    </div>
                    <div>
                        <p className="text-slate-400">{t('analysisHistory.actualCost')}</p>
                        <p className="font-bold text-slate-100">{formatUzs(item.actualCost || 0)}</p>
                    </div>
                    <div>
                        <p className="text-slate-400">{t('analysisHistory.profit')}</p>
                        <p className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatUzs(profit)}</p>
                    </div>
                    <div>
                        <p className="text-slate-400">{t('analysisHistory.margin')}</p>
                        <p className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{margin}%</p>
                    </div>
                </div>
                 <Button onClick={() => setIsEditing(true)} variant="secondary" className="py-1.5 px-3 text-sm ml-4">{t('analysisHistory.editDetails')}</Button>
            </div>
            {item.deliveryNotes && (
                <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-400">{t('analysisHistory.deliveryNotes')}</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.deliveryNotes}</p>
                </div>
            )}
        </div>
    );
};

const AnalysisHistoryManager: React.FC<AnalysisHistoryManagerProps> = ({ onView }) => {
    const { t, locale } = useTranslation();
    const { history, removeAnalysisFromHistory, updateAnalysisStatus, isLoading } = useAnalysisHistory();

    return (
        <div className="p-8 space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>
                    {t('analysisHistory.title')}
                </h2>
                <p className="text-slate-400 mt-2 max-w-2xl mx-auto">{t('analysisHistory.subtitle')}</p>
            </div>
            
            <Card className="p-6">
                 {isLoading ? (
                    <p className="text-slate-400 text-center py-8">{t('loading.title')}...</p>
                ) : history.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">{t('analysisHistory.emptyState')}</p>
                ) : (
                    <ul className="space-y-4">
                        {history.map((item) => (
                           <li key={item.analysisResult.lotId} className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-grow truncate">
                                        <p className="text-slate-200 font-semibold truncate" title={item.analysisResult.sourceIdentifier}>
                                            {item.analysisResult.sourceIdentifier}
                                        </p>
                                        <div className="text-sm text-slate-400 mt-1 space-x-4">
                                            <span>{t('analysisHistory.analyzedOn', { date: new Date(item.timestamp).toLocaleString(locale) })}</span>
                                            <span className="font-semibold">{t('analysisHistory.productsFound', { count: item.analysisResult.products.length })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center">
                                        <StatusSelector 
                                            currentStatus={item.status} 
                                            onUpdate={(status) => updateAnalysisStatus(item.analysisResult.lotId, status)}
                                        />
                                        <Button onClick={() => onView(item)} variant="secondary" className="py-2 px-4">
                                            {t('analysisHistory.viewButton')}
                                        </Button>
                                        <button
                                            onClick={() => removeAnalysisFromHistory(item.analysisResult.lotId)}
                                            title={t('knowledgeBase.deleteTooltip')}
                                            className="p-2.5 rounded-lg text-slate-400 bg-slate-700/50 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                               </div>
                               {item.status === 'won' && <WonTenderDetails item={item} />}
                               {item.analysisResult.potentialScoreData && item.status !== 'won' && (
                                   <PotentialScoreDisplay data={item.analysisResult.potentialScoreData} />
                               )}
                           </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default AnalysisHistoryManager;