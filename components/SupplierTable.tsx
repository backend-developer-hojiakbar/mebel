import React, { useState, useMemo, useEffect } from 'react';
import { Product, Supplier } from '../types';
import { useTranslation } from '../context/I18nContext';
import { Card } from './ui/Card';
import { getUzsPrice, formatDisplayPrice } from '../utils/currency';
import { Button } from './ui/Button';

interface SupplierTableProps {
  product: Product;
  selectedSupplierId: string | null;
  onSelectSupplier: (productId: string, supplierId: string) => void;
  onUpdateSupplier: (productId: string, supplierId: string, updatedData: Partial<Supplier>) => void;
  onAddSupplier: (productId: string, newSupplierData: Omit<Supplier, 'id' | 'score'>) => void;
  onCancelAdd: () => void;
  startInAddMode: boolean;
}

type SortKey = 'companyName' | 'price' | 'totalPrice' | 'region' | 'stockStatus' | 'score';
type EditableField = 'price';
const EMPTY_SUPPLIER = { companyName: '', price: '', phone: 'N/A', website: 'N/A', region: 'UZ', address: 'N/A', stockStatus: 'In Stock' };


const getStockStatusColor = (status: string) => {
    if (!status) return 'bg-slate-700 text-slate-300';
    switch (status.toLowerCase()) {
        case 'in stock':
            return 'bg-teal-500/20 text-teal-300';
        case 'on order':
            return 'bg-yellow-500/20 text-yellow-300';
        case 'out of stock':
            return 'bg-red-500/20 text-red-300';
        default:
            return 'bg-slate-700 text-slate-300';
    }
};

const stockStatusOrder: { [key: string]: number } = {
  'in stock': 1,
  'on order': 2,
  'n/a': 3,
  'out of stock': 4,
};

const ScoreBar: React.FC<{ score?: number }> = ({ score = 0 }) => {
    const percentage = Math.max(0, Math.min(100, score));
    let colorClass = 'bg-red-500';
    if (percentage > 75) {
        colorClass = 'bg-teal-400';
    } else if (percentage > 50) {
        colorClass = 'bg-green-400';
    } else if (percentage > 25) {
        colorClass = 'bg-yellow-400';
    }
    return (
        <div className="w-24 bg-slate-700/50 rounded-full h-2">
            <div className={`${colorClass} h-2 rounded-full transition-all duration-300`} style={{ width: `${percentage}%` }}></div>
        </div>
    );
};


const SupplierTable: React.FC<SupplierTableProps> = ({ product, selectedSupplierId, onSelectSupplier, onUpdateSupplier, onAddSupplier, onCancelAdd, startInAddMode }) => {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copied, setCopied] = useState('');
  const { t } = useTranslation();
  const [editingCell, setEditingCell] = useState<{ supplierId: string, field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Omit<Supplier, 'id' | 'score'>>(EMPTY_SUPPLIER);

  useEffect(() => {
    if (startInAddMode) {
      setIsAdding(true);
      setNewSupplier(EMPTY_SUPPLIER);
    } else {
      setIsAdding(false);
    }
  }, [startInAddMode]);


  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 1500);
  };
  
  const handleStartEditing = (supplier: Supplier, field: EditableField) => {
    setEditingCell({ supplierId: supplier.id, field });
    const price = supplier.price;
    if (typeof price === 'object') {
        setEditValue(price.amount ? `${price.amount} ${price.currency}` : '');
    } else {
        setEditValue(String(price || ''));
    }
  };

  const handleCommitEdit = () => {
    if (editingCell) {
        onUpdateSupplier(product.id, editingCell.supplierId, { [editingCell.field]: editValue });
        setEditingCell(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };
  
  const handleAddNewSupplier = () => {
    if (newSupplier.companyName.trim() && String(newSupplier.price).trim()) {
        onAddSupplier(product.id, newSupplier);
        setIsAdding(false);
        setNewSupplier(EMPTY_SUPPLIER);
    }
  };
  
  const handleCancelAddNew = () => {
    setIsAdding(false);
    onCancelAdd();
  };


  const sortedSuppliers = useMemo(() => {
    return [...product.suppliers].sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;
  
      switch (sortKey) {
        case 'price':
          valA = getUzsPrice(a.price);
          valB = getUzsPrice(b.price);
          break;
        case 'totalPrice':
          valA = getUzsPrice(a.price) * product.quantity;
          valB = getUzsPrice(b.price) * product.quantity;
          break;
        case 'stockStatus':
          valA = stockStatusOrder[String(a.stockStatus || 'n/a').toLowerCase()] || 99;
          valB = stockStatusOrder[String(b.stockStatus || 'n/a').toLowerCase()] || 99;
          break;
        case 'companyName':
        case 'region':
          valA = a[sortKey];
          valB = b[sortKey];
          break;
        case 'score':
          valA = a.score || 0;
          valB = b.score || 0;
          break;
      }

      if (valA < valB) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [product.suppliers, sortKey, sortOrder, product.quantity]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder(key === 'score' ? 'desc' : 'asc'); // Score is best high, others are best low
    }
  };

  const displayStatus = (status: string): string => {
    if (!status) return t('stockStatus.na');
    switch (status.toLowerCase()) {
        case 'in stock': return t('stockStatus.inStock');
        case 'on order': return t('stockStatus.onOrder');
        case 'out of stock': return t('stockStatus.outOfStock');
        default: return t('stockStatus.na');
    }
  }

  const SortableHeader: React.FC<{ sortKeyName: SortKey; children: React.ReactNode; className?: string }> = ({ sortKeyName, children, className }) => {
    const isSorted = sortKey === sortKeyName;
    return (
        <th scope="col" className={`px-4 py-3 ${className}`}>
            <button onClick={() => handleSort(sortKeyName)} className="group flex items-center gap-2 font-semibold uppercase tracking-wider">
                <span>{children}</span>
                <span className={`text-xs transition-opacity ${isSorted ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`}>
                    {sortOrder === 'asc' ? '▲' : '▼'}
                </span>
            </button>
        </th>
    );
  };
  
  const handleNewSupplierChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setNewSupplier(prev => ({ ...prev, [name]: value }));
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex justify-between items-start">
        <div>
            <h3 className="text-xl font-bold mb-1 text-slate-100">{product.name}</h3>
            {product.manufacturer && product.manufacturer !== 'N/A' && (
                <p className="text-md font-semibold text-fuchsia-400">{product.manufacturer}</p>
            )}
        </div>
        {!isAdding && <Button variant="secondary" onClick={() => setIsAdding(true)}>{t('supplierTable.addSupplier')}</Button>}
      </div>
      <p className="text-slate-400 mt-2 mb-4 text-sm">{product.features}</p>
      {product.dimensions && product.dimensions !== 'N/A' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-300 bg-slate-800/40 p-3 rounded-md border border-slate-700/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
            </svg>
            <span className="font-semibold">{t('supplierTable.dimensions')}:</span>
            <span className="font-mono">{product.dimensions}</span>
        </div>
      )}
       {product.ifxtCode && product.ifxtCode !== 'N/A' && (
        <p className="text-xs text-slate-500 mb-4 font-mono">{t('supplierTable.productCode')}: {product.ifxtCode}</p>
      )}
      
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full min-w-max text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-black/10">
            <tr>
              <th scope="col" className="px-4 py-3"></th>
              <SortableHeader sortKeyName="companyName">{t('supplierTable.header.company')}</SortableHeader>
              <SortableHeader sortKeyName="price" className="text-right">{t('supplierTable.header.price')}</SortableHeader>
              <SortableHeader sortKeyName="totalPrice" className="text-right">{t('supplierTable.header.totalPrice')}</SortableHeader>
              <SortableHeader sortKeyName="score">{t('supplierTable.header.score')}</SortableHeader>
              <SortableHeader sortKeyName="stockStatus">{t('supplierTable.header.stockStatus')}</SortableHeader>
              <th scope="col" className="px-4 py-3 uppercase font-semibold tracking-wider">{t('supplierTable.header.contact')}</th>
              <SortableHeader sortKeyName="region">{t('supplierTable.header.region')}</SortableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedSuppliers.map((supplier) => (
              <tr key={supplier.id} className={`transition-colors ${selectedSupplierId === supplier.id ? 'bg-teal-500/10' : 'hover:bg-slate-800/50'}`}>
                <td className="px-4 py-4">
                    <input
                        type="radio"
                        name={`supplier-${product.id}`}
                        checked={selectedSupplierId === supplier.id}
                        onChange={() => onSelectSupplier(product.id, supplier.id)}
                        className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 focus:ring-teal-500"
                    />
                </td>
                <td className="px-4 py-4 font-medium text-slate-100 whitespace-nowrap">
                  {supplier.website && supplier.website !== 'N/A' ? (
                    <a 
                      href={!supplier.website.startsWith('http') ? `//${supplier.website}` : supplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-teal-400 hover:underline"
                    >
                      {supplier.companyName}
                    </a>
                  ) : (
                    supplier.companyName
                  )}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-200 text-right whitespace-nowrap">
                    {editingCell?.supplierId === supplier.id && editingCell.field === 'price' ? (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCommitEdit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="w-32 bg-slate-900 border border-teal-400 rounded-md p-1 text-sm text-slate-100 focus:ring-0 focus:outline-none text-right"
                            autoFocus
                        />
                    ) : (
                         <div 
                            className="group relative flex items-center justify-end gap-1 cursor-pointer p-1"
                            onClick={() => handleStartEditing(supplier, 'price')}
                            title={t('supplierTable.editTooltip')}
                         >
                            <span>{formatDisplayPrice(supplier.price)}</span>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </td>
                <td className="px-4 py-4 font-bold text-teal-300 text-right whitespace-nowrap">{formatDisplayPrice(supplier.price, product.quantity)}</td>
                <td className="px-4 py-4">
                  <ScoreBar score={supplier.score} />
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStockStatusColor(supplier.stockStatus)}`}>
                    {displayStatus(supplier.stockStatus)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span>{supplier.phone}</span>
                    {supplier.phone && supplier.phone !== 'N/A' && (
                       <button onClick={() => handleCopy(supplier.phone)} className="text-slate-500 hover:text-teal-400 transition-colors" title={t('supplierTable.copyTooltip')}>
                         {copied === supplier.phone ? 
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> :
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         }
                       </button>
                    )}
                  </div>
                  {supplier.address && supplier.address !== 'N/A' && (
                    <div className="text-xs text-slate-500 mt-1 max-w-xs truncate" title={supplier.address}>{supplier.address}</div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${supplier.region === 'UZ' ? 'bg-green-500/20 text-green-300' : 'bg-fuchsia-500/20 text-fuchsia-300'}`}>
                    {supplier.region}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {isAdding && (
             <tfoot className="border-t-2 border-teal-400/30">
                <tr className="bg-slate-800">
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3">
                        <input type="text" name="companyName" value={newSupplier.companyName} onChange={handleNewSupplierChange} placeholder={t('supplierTable.form.companyName')} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400" />
                    </td>
                    <td className="px-4 py-3 text-right">
                         <input type="text" name="price" value={newSupplier.price as string} onChange={handleNewSupplierChange} placeholder={t('supplierTable.form.price')} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400 text-right" />
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3">
                         <select name="stockStatus" value={newSupplier.stockStatus} onChange={handleNewSupplierChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400">
                             <option value="In Stock">{t('stockStatus.inStock')}</option>
                             <option value="On Order">{t('stockStatus.onOrder')}</option>
                             <option value="Out of Stock">{t('stockStatus.outOfStock')}</option>
                             <option value="N/A">{t('stockStatus.na')}</option>
                         </select>
                    </td>
                    <td className="px-4 py-3" colSpan={2}>
                        <div className="flex items-center gap-2">
                             <input type="text" name="phone" value={newSupplier.phone} onChange={handleNewSupplierChange} placeholder={t('supplierTable.form.phone')} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-slate-200 focus:ring-teal-400 focus:border-teal-400" />
                             <Button onClick={handleAddNewSupplier} className="py-2 px-3 text-sm">{t('supplierTable.form.save')}</Button>
                             <Button onClick={handleCancelAddNew} variant="secondary" className="py-2 px-3 text-sm">{t('supplierTable.form.cancel')}</Button>
                        </div>
                    </td>
                </tr>
             </tfoot>
          )}
        </table>
        {sortedSuppliers.length === 0 && !isAdding && (
            <div className="text-center py-12">
                <p className="text-slate-500">{t('supplierTable.noSuppliers')}</p>
            </div>
        )}
      </div>
    </Card>
  );
};

export default SupplierTable;