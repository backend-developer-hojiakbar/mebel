

import React, { useState } from 'react';
import { AnalysisRequest, TenderPlatform, TenderType, GenerativePart } from '../types';
import { PLATFORMS, TENDER_TYPES } from '../constants';
import { Card } from './ui/Card';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { FileUpload } from './ui/FileUpload';
import { Button } from './ui/Button';
import { useTranslation } from '../context/I18nContext';
import { extractTextFromFile, fileToGenerativePart } from '../utils/fileExtractor';


interface NewAnalysisFormProps {
  onStartAnalysis: (request: Omit<AnalysisRequest, 'uiLanguage'>) => void;
}

const NewAnalysisForm: React.FC<NewAnalysisFormProps> = ({ onStartAnalysis }) => {
  const [platform, setPlatform] = useState<TenderPlatform>(TenderPlatform.UZEX);
  const [tenderType, setTenderType] = useState<TenderType>(TenderType.AUCTION);
  const [lotUrl, setLotUrl] = useState('');
  const [lotFile, setLotFile] = useState<File | null>(null);
  const [lotImages, setLotImages] = useState<File[]>([]);
  const [error, setError] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotUrl && !lotFile) {
      setError(t('form.error.noSource'));
      return;
    }
    setError('');
    setIsProcessingFile(true);

    let fileContent: string | undefined;
    let imageParts: GenerativePart[] | undefined;

    if (lotFile) {
        try {
            fileContent = await extractTextFromFile(lotFile);
        } catch (err) {
            setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setIsProcessingFile(false);
            return;
        }
    }

    if (lotImages.length > 0) {
        try {
            imageParts = await Promise.all(lotImages.map(file => fileToGenerativePart(file)));
        } catch (err) {
            setError(`Error processing images: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setIsProcessingFile(false);
            return;
        }
    }
    
    onStartAnalysis({
        platform,
        tenderType,
        url: lotUrl || undefined,
        content: fileContent,
        fileName: lotFile?.name,
        images: imageParts,
    });
  };

  const handleFileChange = (files: File[]) => {
    setLotFile(files[0] || null);
  };

  const handleImageChange = (files: File[]) => {
    setLotImages(files);
  };
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLotUrl(e.target.value);
  };


  return (
    <Card>
      <div className="p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(20, 184, 166, 0.5)' }}>{t('form.title')}</h2>
          <p className="text-slate-400 mt-2">{t('form.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              label={t('form.platformLabel')}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as TenderPlatform)}
              options={PLATFORMS.map(p => ({ value: p.value, label: t(p.labelKey) }))}
            />
            <Select
              label={t('form.tenderTypeLabel')}
              value={tenderType}
              onChange={(e) => setTenderType(e.target.value as TenderType)}
              options={TENDER_TYPES.map(type => ({ value: type.value, label: t(type.labelKey) }))}
            />
          </div>

          <div>
            <Input
                label={t('form.urlLabel')}
                id="lot-url"
                type="url"
                placeholder="https://xarid.uzex.uz/ru/trade/lot/1234567"
                value={lotUrl}
                onChange={handleUrlChange}
                disabled={isProcessingFile}
            />
             <p className="mt-2 text-xs text-slate-500">
                {t('form.urlHint')}
            </p>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-700/50"></div>
            <span className="flex-shrink mx-4 text-slate-500 font-semibold text-sm">{t('form.or')}</span>
            <div className="flex-grow border-t border-slate-700/50"></div>
          </div>

          <div>
            <FileUpload
                label={t('form.fileLabel')}
                onFilesChange={handleFileChange}
                files={lotFile ? [lotFile] : []}
                disabled={isProcessingFile}
                accept=".html,.htm,.pdf,.docx"
            />
          </div>
          
          <div className="pt-2">
            <FileUpload
                label={t('form.imageLabel')}
                onFilesChange={handleImageChange}
                files={lotImages}
                disabled={isProcessingFile}
                multiple={true}
                accept="image/jpeg,image/png,image/webp"
            />
          </div>
          
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={isProcessingFile}>
              {isProcessingFile ? t('form.processingFile') : t('form.submitButton')}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
};

export default NewAnalysisForm;