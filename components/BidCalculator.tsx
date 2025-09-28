
import React, { useState, useMemo, useCallback } from 'react';
import { Card } from './ui/Card';
import { useTranslation } from '../context/I18nContext';
import { Product, Supplier, AdditionalCosts, BidRecommendation } from '../types';
import { Button } from './ui/Button';
import { getUzsPrice } from '../utils/currency';
import { getBidRecommendation } from '../services/geminiService';

interface BidCalculatorProps {
    products: Product[];
    selectedSuppliers: Record<string, string>;
    tenderContent?: string;
}

const CostInput: React.FC<{ label: string, value: number, onChange: (value: number) => void, isPercent?: boolean }> = ({ label, value, onChange, isPercent = true }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300">
            {label}
        </label>
        <div className="relative mt-1">
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400 pr-10"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-sm">{isPercent ? '%' : 'UZS'}</span>
        </div>
    </div>
);

const BidCalculator: React.FC<BidCalculatorProps> = ({ products, selectedSuppliers, tenderContent }) => {
    const { t, locale } = useTranslation();
    const [costs, setCosts] = useState<AdditionalCosts>({
        logisticsCost: 200000,
        bankGuaranteeCost: 100000,
        commissionCost: 300000,
        fixedCosts: 100000,
        profitMarginPercent: 5,
    });
    const [recommendation, setRecommendation] = useState<BidRecommendation | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCostChange = (field: keyof AdditionalCosts, value: number) => {
        setCosts(prev => ({ ...prev, [field]: value }));
    };

    const selectedProductsWithSuppliers = useMemo(() => {
        return products.map(product => {
            const supplierId = selectedSuppliers[product.id];
            const supplier = product.suppliers.find(s => s.id === supplierId);
            return { product, supplier };
        }).filter(item => item.supplier) as { product: Product, supplier: Supplier }[];
    }, [products, selectedSuppliers]);

    const canCalculate = useMemo(() => {
        return products.length > 0 && selectedProductsWithSuppliers.length === products.length;
    }, [products, selectedProductsWithSuppliers]);


    const handleCalculate = useCallback(async () => {
        if (!canCalculate) return;
        setIsLoading(true);
        setError(null);
        setRecommendation(null);

        try {
            const result = await getBidRecommendation(selectedProductsWithSuppliers, costs, tenderContent, locale);
            setRecommendation(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [canCalculate, selectedProductsWithSuppliers, costs, tenderContent, locale]);
    
    const formatUzs = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS' }).format(amount);

    return (
        <Card className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>
                {t('bidCalculator.title')}
            </h2>
            <p className="text-slate-400 mt-1 mb-6">{t('bidCalculator.subtitle')}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-teal-300">{t('bidCalculator.costsTitle')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <CostInput label={t('bidCalculator.logistics')} value={costs.logisticsCost} onChange={v => handleCostChange('logisticsCost', v)} isPercent={false} />
                        <CostInput label={t('bidCalculator.bankGuarantee')} value={costs.bankGuaranteeCost} onChange={v => handleCostChange('bankGuaranteeCost', v)} isPercent={false} />
                        <CostInput label={t('bidCalculator.commission')} value={costs.commissionCost} onChange={v => handleCostChange('commissionCost', v)} isPercent={false} />
                        <CostInput label={t('bidCalculator.profitMargin')} value={costs.profitMarginPercent} onChange={v => handleCostChange('profitMarginPercent', v)} />
                        <div className="sm:col-span-2">
                             <CostInput label={t('bidCalculator.fixedCosts')} value={costs.fixedCosts} onChange={v => handleCostChange('fixedCosts', v)} isPercent={false} />
                        </div>
                    </div>
                     <Button onClick={handleCalculate} disabled={!canCalculate || isLoading} className="w-full">
                        {isLoading ? t('bidCalculator.calculating') : t('bidCalculator.calculateButton')}
                    </Button>
                    {!canCalculate && <p className="text-center text-sm text-yellow-400">{t('bidCalculator.selectSuppliersPrompt')}</p>}
                </div>
                
                {/* Results */}
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-teal-300 mb-4">{t('bidCalculator.recommendationTitle')}</h3>
                    {isLoading && <div className="text-center p-8">{t('bidCalculator.calculating')}</div>}
                    {error && <div className="text-center p-8 text-red-400">{error}</div>}
                    {recommendation && (
                        <div className="space-y-6">
                           <div>
                                <p className="text-sm text-slate-400">{t('bidCalculator.recommendedBid')}</p>
                                <p className="text-4xl font-bold text-teal-300 tracking-tight">{formatUzs(recommendation.recommendedBid)}</p>
                           </div>
                           <div className="space-y-4">
                               <div className="p-4 bg-slate-900/50 rounded-md">
                                   <h4 className="font-semibold text-fuchsia-400">{t('bidCalculator.competitorAnalysis')}</h4>
                                   <p className="text-sm text-slate-300 mt-1">{recommendation.competitorAnalysis}</p>
                               </div>
                               <div className="p-4 bg-slate-900/50 rounded-md">
                                   <h4 className="font-semibold text-fuchsia-400">{t('bidCalculator.justification')}</h4>
                                   <p className="text-sm text-slate-300 mt-1">{recommendation.justification}</p>
                               </div>
                           </div>
                           <div>
                               <h4 className="font-semibold text-slate-200 mb-2">{t('bidCalculator.costBreakdownTitle')}</h4>
                               <ul className="text-sm space-y-1 text-slate-300 font-mono">
                                   <li className="flex justify-between"><span>{t('bidCalculator.goodsTotal')}:</span> <span>{formatUzs(recommendation.costBreakdown.goodsTotal)}</span></li>
                                   <li className="flex justify-between"><span>{t('bidCalculator.logisticsCost')}:</span> <span>{formatUzs(recommendation.costBreakdown.logisticsCost)}</span></li>
                                   <li className="flex justify-between"><span>{t('bidCalculator.bankGuaranteeCost')}:</span> <span>{formatUzs(recommendation.costBreakdown.bankGuaranteeCost)}</span></li>
                                   <li className="flex justify-between"><span>{t('bidCalculator.commissionCost')}:</span> <span>{formatUzs(recommendation.costBreakdown.commissionCost)}</span></li>
                                    <li className="flex justify-between"><span>{t('bidCalculator.fixedCosts')}:</span> <span>{formatUzs(recommendation.costBreakdown.fixedCosts)}</span></li>
                                   <li className="flex justify-between font-bold border-t border-slate-600 pt-1 mt-1"><span>{t('bidCalculator.subtotal')}:</span> <span>{formatUzs(recommendation.costBreakdown.subtotal)}</span></li>
                                   <li className="flex justify-between text-green-400"><span>{t('bidCalculator.profit')}:</span> <span>{formatUzs(recommendation.costBreakdown.profitMargin)}</span></li>
                                   <li className="flex justify-between font-bold text-lg border-t-2 border-slate-500 pt-2 mt-2 text-slate-100"><span>{t('bidCalculator.total')}:</span> <span>{formatUzs(recommendation.costBreakdown.total)}</span></li>
                               </ul>
                           </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default BidCalculator;