
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AnalysisResult, Product, Supplier } from '../types';
import ProductList from './ProductList';
import SupplierTable from './SupplierTable';
import { Button } from './ui/Button';
import { useTranslation } from '../context/I18nContext';
import { Card } from './ui/Card';
import { StatCard } from './ui/StatCard';
import { getUzsPrice, parsePrice } from '../utils/currency';
import { researchSingleProduct } from '../services/geminiService';
import BidCalculator from './BidCalculator';


const ResultsDisplay: React.FC<{ result: AnalysisResult; onNewAnalysis: () => void; getKnowledgeBaseContent: () => string; }> = ({ result, onNewAnalysis, getKnowledgeBaseContent }) => {
  const [editableResult, setEditableResult] = useState<AnalysisResult>(result);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [researchingProductId, setResearchingProductId] = useState<string | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, string>>({});
  const [addingSupplierForProductId, setAddingSupplierForProductId] = useState<string | null>(null);
  const { t } = useTranslation();

  // Sync internal state if the prop (e.g., from history) changes
  useEffect(() => {
    setEditableResult(result);
    
    // Auto-select suppliers where there's only one option
    const initialSelections: Record<string, string> = {};
    result.products.forEach(p => {
        if (p.suppliers.length === 1) {
            initialSelections[p.id] = p.suppliers[0].id;
        }
    });
    setSelectedSuppliers(initialSelections);

  }, [result]);
  
  const handleSelectSupplier = useCallback((productId: string, supplierId: string) => {
    setSelectedSuppliers(prev => ({ ...prev, [productId]: supplierId }));
  }, []);

  const handleSelectProduct = useCallback((product: Product) => {
    const scoredProduct = {
        ...product,
        suppliers: product.suppliers.map((supplier: Supplier) => {
            let score = 50; // Base score
            const priceNum = getUzsPrice(supplier.price);
            if (priceNum > 0 && priceNum !== Infinity) score += 10; else score -= 20;
            const stockStatus = String(supplier.stockStatus || '').toLowerCase();
            if (stockStatus === 'in stock') score += 30;
            if (stockStatus === 'on order') score += 10;
            if (stockStatus === 'out of stock') score -= 30;
            if (supplier.region === 'UZ') score += 15;
            return { ...supplier, score: Math.max(0, Math.min(100, score)) };
        })
    };
    setSelectedProduct(scoredProduct);
  }, []);
  
  useEffect(() => {
    if (editableResult.products && editableResult.products.length > 0 && !selectedProduct) {
        handleSelectProduct(editableResult.products[0]);
    }
  }, [editableResult, selectedProduct, handleSelectProduct]);

  const handleResearchProduct = async (productToResearch: Product) => {
      setResearchingProductId(productToResearch.id);
      try {
          const knowledgeBaseContent = getKnowledgeBaseContent();
          const updatedProduct = await researchSingleProduct(productToResearch, knowledgeBaseContent);
          
          setEditableResult(prevResult => {
              const newProducts = prevResult.products.map(p => 
                  p.id === updatedProduct.id ? updatedProduct : p
              );
              return { ...prevResult, products: newProducts };
          });
          
          // Reselect the product to update the supplier table with new scores
          handleSelectProduct(updatedProduct);

      } catch (error) {
          console.error("Failed to re-research product:", error);
          // Optionally show an error to the user
      } finally {
          setResearchingProductId(null);
      }
  };

  const handleUpdateSupplier = useCallback((productId: string, supplierId: string, updatedData: Partial<Supplier>) => {
    setEditableResult(prevResult => {
        const newProducts = prevResult.products.map(p => {
            if (p.id === productId) {
                const newSuppliers = p.suppliers.map(s => {
                    if (s.id === supplierId) {
                        return { ...s, ...updatedData };
                    }
                    return s;
                });
                return { ...p, suppliers: newSuppliers };
            }
            return p;
        });

        const updatedFullResult = { ...prevResult, products: newProducts };
        
        if (selectedProduct?.id === productId) {
            const productToReselect = updatedFullResult.products.find(p => p.id === productId);
            if (productToReselect) {
                handleSelectProduct(productToReselect);
            }
        }
        
        return updatedFullResult;
    });
  }, [selectedProduct, handleSelectProduct]);

  const handleInitiateAddSupplier = useCallback((productId: string) => {
      const productToSelect = editableResult.products.find(p => p.id === productId);
      if (productToSelect) {
          handleSelectProduct(productToSelect);
          setAddingSupplierForProductId(productId);
      }
  }, [editableResult.products, handleSelectProduct]);

  const handleAddSupplier = useCallback((productId: string, newSupplierData: Omit<Supplier, 'id' | 'score'>) => {
      setEditableResult(prevResult => {
          const newProducts = prevResult.products.map(p => {
              if (p.id === productId) {
                  const newSupplier: Supplier = {
                      ...newSupplierData,
                      id: `manual-${Date.now()}`
                  };
                  const updatedSuppliers = [...p.suppliers, newSupplier];
                  return { ...p, suppliers: updatedSuppliers };
              }
              return p;
          });
          const updatedFullResult = { ...prevResult, products: newProducts };
           if (selectedProduct?.id === productId) {
              const productToReselect = updatedFullResult.products.find(p => p.id === productId);
              if (productToReselect) {
                  handleSelectProduct(productToReselect);
              }
          }
          return updatedFullResult;
      });
      setAddingSupplierForProductId(null); // Close the add form
  }, [selectedProduct, handleSelectProduct]);

  const handleCancelAddSupplier = useCallback(() => {
      setAddingSupplierForProductId(null);
  }, []);

  const totalSuppliers = useMemo(() => {
    return editableResult.products.reduce((acc, product) => acc + product.suppliers.length, 0);
  }, [editableResult.products]);

  const handleExport = () => {
    const headers = [
      t('csv.header.position'),
      t('csv.header.productName'),
      t('csv.header.features'),
      t('csv.header.unit'),
      t('csv.header.quantity'),
      t('csv.header.startPrice'),
      t('csv.header.supplier'),
      t('csv.header.unitPriceOriginal'),
      t('csv.header.totalPriceUzs'),
      t('csv.header.phone'),
      t('csv.header.website'),
      t('csv.header.region'),
    ].join(',');

    let csvContent = "data:text/csv;charset=utf-8," + headers + "\r\n";

    editableResult.products.forEach(product => {
        if (product.suppliers.length > 0) {
            product.suppliers.forEach(supplier => {
                const originalPrice = parsePrice(supplier.price);
                const totalUzs = getUzsPrice(supplier.price) * product.quantity;

                const originalPriceStr = originalPrice.amount === Infinity ? 'N/A' : `${originalPrice.amount} ${originalPrice.currency}`;
                const totalUzsStr = totalUzs === Infinity ? 'N/A' : `${totalUzs} UZS`;

                const row = [
                    `"${(product.positionNumber ?? '').replace(/"/g, '""')}"`,
                    `"${(product.name ?? '').replace(/"/g, '""')}"`,
                    `"${(product.features ?? '').replace(/"/g, '""')}"`,
                    product.unit ?? '',
                    product.quantity ?? 0,
                    `"${(product.startPrice ?? 'N/A').replace(/"/g, '""')}"`,
                    `"${(supplier.companyName ?? '').replace(/"/g, '""')}"`,
                    `"${originalPriceStr.replace(/"/g, '""')}"`,
                    `"${totalUzsStr.replace(/"/g, '""')}"`,
                    `"${(supplier.phone ?? '').replace(/"/g, '""')}"`,
                    supplier.website ?? '',
                    supplier.region ?? ''
                ].join(',');
                csvContent += row + "\r\n";
            });
        } else {
             const row = [
                `"${(product.positionNumber ?? '').replace(/"/g, '""')}"`,
                `"${(product.name ?? '').replace(/"/g, '""')}"`,
                `"${(product.features ?? '').replace(/"/g, '""')}"`,
                product.unit ?? '',
                product.quantity ?? 0,
                `"${(product.startPrice ?? 'N/A').replace(/"/g, '""')}"`,
                t('supplierTable.noSuppliers'), "", "", "", "", "", ""
            ].join(',');
            csvContent += row + "\r\n";
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tender_analysis_${editableResult.lotId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>{t('results.title')}</h2>
                <p className="text-slate-400 mt-1">{t('results.subtitle', { count: editableResult.products.length })}</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
                <Button onClick={handleExport} variant="secondary">
                    {t('results.exportButton')}
                </Button>
                <Button onClick={onNewAnalysis}>
                    {t('results.newAnalysisButton')}
                </Button>
            </div>
        </div>

        <Card className="p-4">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 px-2">{t('results.summary.title')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label={t('results.summary.productsFound')} value={editableResult.products.length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>} />
              <StatCard label={t('results.summary.suppliersAnalyzed')} value={totalSuppliers} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
              <StatCard label={t('results.summary.source')} value={editableResult.sourceIdentifier} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>} />
          </div>
        </Card>
      
        {editableResult.analysisSummary && (
           <Card className="p-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-fuchsia-400 mb-2" style={{ textShadow: '0 0 8px rgba(217, 70, 239, 0.4)'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {t('results.summary.aiInsightTitle')}
                </h3>
                <p className="text-slate-300 text-md leading-relaxed">{editableResult.analysisSummary}</p>
            </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <ProductList
                    products={editableResult.products}
                    selectedProduct={selectedProduct}
                    onSelectProduct={handleSelectProduct}
                    onResearchProduct={handleResearchProduct}
                    researchingProductId={researchingProductId}
                    onInitiateAddSupplier={handleInitiateAddSupplier}
                />
            </div>
            <div className="lg:col-span-2">
                {selectedProduct ? (
                    <SupplierTable 
                        product={selectedProduct} 
                        selectedSupplierId={selectedSuppliers[selectedProduct.id] || null}
                        onSelectSupplier={handleSelectSupplier}
                        onUpdateSupplier={handleUpdateSupplier}
                        onAddSupplier={handleAddSupplier}
                        onCancelAdd={handleCancelAddSupplier}
                        startInAddMode={addingSupplierForProductId === selectedProduct.id}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full bg-slate-800/50 rounded-lg p-8 border border-slate-700/50">
                        <p className="text-slate-400">{t('results.selectProductPrompt')}</p>
                    </div>
                )}
            </div>
        </div>
        
        <BidCalculator 
            products={editableResult.products}
            selectedSuppliers={selectedSuppliers}
            tenderContent={editableResult.tenderContent}
        />
    </div>
  );
};

export default ResultsDisplay;
