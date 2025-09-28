
import React, { useState } from 'react';
import { useTranslation } from '../context/I18nContext';
import { useKnowledgeBase } from '../context/KnowledgeBaseContext';
import { FileUpload } from './ui/FileUpload';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Contract } from '../types';

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <dt className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</dt>
        <dd className="mt-1 text-slate-200 font-semibold truncate" title={typeof value === 'string' ? value : ''}>{value}</dd>
    </div>
);

const ContractDetailsSkeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-10 bg-slate-700/50 rounded-md"></div>
            <div className="h-10 bg-slate-700/50 rounded-md"></div>
            <div className="h-10 bg-slate-700/50 rounded-md"></div>
        </div>
        <div className="h-6 w-1/3 bg-slate-700/50 rounded-md mt-6"></div>
        <div className="space-y-2">
            <div className="h-8 bg-slate-700/50 rounded-md"></div>
            <div className="h-8 bg-slate-700/50 rounded-md w-5/6"></div>
        </div>
    </div>
);

const ContractItem: React.FC<{ contract: Contract }> = ({ contract }) => {
    const { t } = useTranslation();
    const { removeContract } = useKnowledgeBase();
    const { details } = contract;

    const isError = details?.customer === 'Error';

    return (
        <li className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2-2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <span className="text-slate-300 truncate" title={contract.fileName}>{contract.fileName}</span>
                </div>
                <button
                    onClick={() => removeContract(contract.id)}
                    title={t('knowledgeBase.deleteTooltip')}
                    className="p-1.5 rounded-full text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            <div className="pt-3 border-t border-slate-700/50">
                {contract.processing ? (
                    <ContractDetailsSkeleton />
                ) : isError ? (
                    <div className="text-red-400 text-sm">
                        <p className="font-semibold">{t('knowledgeBase.errorProcessing')}</p>
                        <p className="text-xs mt-1 opacity-80">{details?.supplier}</p>
                    </div>
                ) : details ? (
                    <div className="space-y-4">
                        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <DetailItem label={t('knowledgeBase.details.customer')} value={details.customer} />
                            <DetailItem label={t('knowledgeBase.details.supplier')} value={details.supplier} />
                            <DetailItem label={t('knowledgeBase.details.totalValue')} value={details.totalValue} />
                        </dl>
                        {details.products.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-2">{t('knowledgeBase.details.productsTitle')}</h4>
                                <div className="border border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-900/50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-slate-400">{t('knowledgeBase.details.product')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-slate-400">{t('knowledgeBase.details.quantity')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-slate-400">{t('knowledgeBase.details.unitPrice')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {details.products.map((p, i) => (
                                                <tr key={i} className="bg-slate-800/30">
                                                    <td className="px-3 py-2 text-slate-300">{p.name}</td>
                                                    <td className="px-3 py-2 text-right text-slate-300">{p.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{p.unitPrice}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </li>
    );
};

const KnowledgeBaseManager: React.FC = () => {
    const { t } = useTranslation();
    const { contracts, addContracts, isLoading } = useKnowledgeBase();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleFilesChange = (files: File[]) => {
        setSelectedFiles(files);
        setError('');
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            setError('Please select at least one file to upload.');
            return;
        }
        setIsProcessing(true);
        setError('');
        try {
            await addContracts(selectedFiles);
            setSelectedFiles([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process files.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const uploadButtonText = () => {
        if(isProcessing) return t('form.processingFile');
        if(selectedFiles.length > 0) return t('knowledgeBase.uploadButtonMultiple', { count: selectedFiles.length });
        return t('knowledgeBase.uploadButton');
    }

    return (
        <div className="p-8 space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>
                    {t('knowledgeBase.title')}
                </h2>
                <p className="text-slate-400 mt-2 max-w-2xl mx-auto">{t('knowledgeBase.subtitle')}</p>
            </div>

            <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-2">
                        <FileUpload
                            label=""
                            onFilesChange={handleFilesChange}
                            files={selectedFiles}
                            disabled={isProcessing}
                            multiple={true}
                        />
                    </div>
                    <div className="flex flex-col">
                        <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || isProcessing}>
                           {uploadButtonText()}
                        </Button>
                        {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-xl font-semibold text-slate-200 mb-4">{t('knowledgeBase.uploadedContracts')}</h3>
                {isLoading ? (
                    <p className="text-slate-400">{t('loading.title')}...</p>
                ) : contracts.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">{t('knowledgeBase.emptyState')}</p>
                ) : (
                    <ul className="space-y-4">
                        {contracts.map((contract) => (
                           <ContractItem key={contract.id} contract={contract} />
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default KnowledgeBaseManager;