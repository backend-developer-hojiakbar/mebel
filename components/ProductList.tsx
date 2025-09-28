
import React, { useMemo, useState } from 'react';
import { Product } from '../types';
import { useTranslation } from '../context/I18nContext';
import { Card } from './ui/Card';
import { getUzsPrice } from '../utils/currency';
import { Button } from './ui/Button';

interface ProductListProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onResearchProduct: (product: Product) => void;
  researchingProductId: string | null;
  onInitiateAddSupplier: (productId: string) => void;
}

const ProductItemEditor: React.FC<{
  product: Product;
  onSave: (updatedProduct: Product) => void;
  onCancel: () => void;
}> = ({ product, onSave, onCancel }) => {
  const [editedProduct, setEditedProduct] = useState(product);
  const { t } = useTranslation();

  const handleSave = () => {
    onSave(editedProduct);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setEditedProduct(prev => ({...prev, [name]: value}));
  }

  return (
    <div className="p-4 bg-slate-900/50 space-y-4">
        <div>
            <label htmlFor="productName" className="text-xs font-bold text-slate-400">{t('productList.edit.name')}</label>
            <input 
                id="productName"
                name="name"
                type="text"
                value={editedProduct.name}
                onChange={handleChange}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400"
            />
        </div>
        <div>
            <label htmlFor="productFeatures" className="text-xs font-bold text-slate-400">{t('productList.edit.features')}</label>
            <textarea 
                id="productFeatures"
                name="features"
                value={editedProduct.features}
                onChange={handleChange}
                rows={4}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400"
            />
        </div>
        <div className="flex justify-end gap-2">
            <Button onClick={onCancel} variant="secondary" className="py-1.5 px-3 text-sm">{t('productList.edit.cancel')}</Button>
            <Button onClick={handleSave} className="py-1.5 px-3 text-sm">{t('productList.edit.research')}</Button>
        </div>
    </div>
  )
}


const ProductList: React.FC<ProductListProps> = ({ products, selectedProduct, onSelectProduct, onResearchProduct, researchingProductId, onInitiateAddSupplier }) => {
  const { t } = useTranslation();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const product of products) {
      const key = product.positionNumber || '...';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(product);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [products]);

  const handleStartEditing = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProductId(product.id);
  };
  
  const handleCancelEditing = () => {
    setEditingProductId(null);
  }

  const handleSaveAndResearch = (updatedProduct: Product) => {
    onResearchProduct(updatedProduct);
    setEditingProductId(null);
  }

  return (
    <Card className="overflow-hidden">
      <h3 className="text-lg font-semibold p-4 border-b border-teal-400/10 text-slate-200">{t('productList.title')}</h3>
      <div className="max-h-[600px] overflow-y-auto">
        {groupedProducts.map(([positionNumber, productsInGroup]) => (
          <div key={positionNumber} className="border-b border-slate-800 last:border-b-0">
            <h4 className="bg-slate-800/50 px-4 py-2 text-sm font-bold tracking-wider text-teal-300 sticky top-0 z-10">
              {t('productList.positionHeader', { number: positionNumber.replace(/[^0-9]/g, '') || '...' })}
            </h4>
            <ul>
              {productsInGroup.map((product) => {
                if(editingProductId === product.id) {
                    return (
                       <li key={product.id} className="relative border-t border-slate-800">
                           <ProductItemEditor 
                              product={product}
                              onSave={handleSaveAndResearch}
                              onCancel={handleCancelEditing}
                           />
                       </li>
                    )
                }

                const productSuppliers = product.suppliers || [];
                const bestPriceInUzs = productSuppliers.length > 0 ? Math.min(...productSuppliers.map(s => getUzsPrice(s.price))) : Infinity;
                const startPriceInUzs = product.startPrice ? getUzsPrice(product.startPrice) : Infinity;
                const isPriceLower = bestPriceInUzs < startPriceInUzs;
                const isResearching = researchingProductId === product.id;

                return (
                  <li key={product.id} className="relative border-t border-slate-800">
                     {isResearching && (
                        <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center z-20">
                            <svg className="animate-spin h-6 w-6 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-2 text-slate-300 font-semibold">{t('productList.researching')}</span>
                        </div>
                    )}
                    <button
                      onClick={() => onSelectProduct(product)}
                      className={`w-full text-left p-4 transition-colors duration-200 group ${
                        selectedProduct?.id === product.id
                          ? 'bg-teal-400/10'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      {selectedProduct?.id === product.id && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-teal-400 to-fuchsia-500"></div>
                      )}

                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-grow">
                             <p className={`font-semibold transition-colors ${selectedProduct?.id === product.id ? 'text-teal-300' : 'text-slate-100 group-hover:text-teal-300'}`}>
                                {product.name}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                {product.manufacturer !== 'N/A' ? `${product.manufacturer} | ` : ''}{product.quantity} {product.unit}
                            </p>
                        </div>
                        <button onClick={(e) => handleStartEditing(product, e)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-700 hover:text-slate-200 transition-colors flex-shrink-0">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                        </button>
                      </div>

                      {product.ifxtCode && product.ifxtCode !== 'N/A' && (
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                          {t('supplierTable.productCode')}: {product.ifxtCode}
                        </p>
                      )}

                      <div className="mt-2 text-xs space-y-1">
                        {product.startPrice && product.startPrice !== 'N/A' && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">{t('productList.startPrice')}:</span>
                                <span className="font-mono text-slate-400">{product.startPrice}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">{t('productList.bestPrice')}:</span>
                            <div className="flex items-center gap-1">
                                {bestPriceInUzs !== Infinity ? (
                                    <span className={`font-mono font-bold ${isPriceLower ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {`${bestPriceInUzs.toLocaleString('ru-RU')} UZS`}
                                    </span>
                                ) : (
                                    <span className="text-slate-500">N/A</span>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onInitiateAddSupplier(product.id); }}
                                    title={t('productList.addPriceTooltip')}
                                    className="p-1 rounded-md text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                      </div>

                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ProductList;
