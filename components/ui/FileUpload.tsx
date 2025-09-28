import React, { useRef } from 'react';
import { useTranslation } from '../../context/I18nContext';

interface FileUploadProps {
    label: string;
    onFilesChange: (files: File[]) => void;
    files: File[];
    disabled?: boolean;
    multiple?: boolean;
    accept?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFilesChange, files, disabled, multiple = false, accept }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const handleFileAdd = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = event.target.files ? Array.from(event.target.files) : [];
        if (newFiles.length === 0) return;

        if (!multiple) {
            onFilesChange(newFiles.slice(0, 1));
        } else {
            const fileKeys = new Set(files.map(f => `${f.name}-${f.size}-${f.lastModified}`));
            // FIX: Explicitly type 'f' as 'File' to resolve type inference issue where it was treated as 'unknown'.
            const uniqueNewFiles = newFiles.filter((f: File) => !fileKeys.has(`${f.name}-${f.size}-${f.lastModified}`));
            onFilesChange([...files, ...uniqueNewFiles]);
        }
    };

    const handleFileRemove = (fileToRemove: File, e: React.MouseEvent) => {
        e.stopPropagation();
        onFilesChange(files.filter(f => f !== fileToRemove));
    };

    const handleContainerClick = () => {
        if (!disabled && fileInputRef.current) {
            fileInputRef.current.value = ""; // Allow re-selecting the same file
            fileInputRef.current.click();
        }
    };

    const displayFormats = accept
        ?.split(',')
        .map(format => format.split('/').pop()?.toUpperCase() || format.replace('.', '').toUpperCase())
        .join(', ');

    const DropzoneContent = () => (
        <div className="flex flex-col items-center">
            <svg className="w-10 h-10 text-slate-500 group-hover:text-teal-400 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm text-slate-400">
                <span className="font-semibold text-teal-400">{t('form.file.clickToUpload')}</span> {multiple ? t('form.file.addMoreHint') : t('form.file.dragAndDrop')}
            </p>
            {displayFormats && <p className="text-xs text-slate-500 mt-1">{t('form.file.supportedFormats', { formats: displayFormats })}</p>}
        </div>
    );
    
    const SingleFileDisplay = () => (
        <div className="flex items-center justify-between w-full text-sm text-slate-300">
           <div className="flex items-center truncate">
             <svg className="w-5 h-5 mr-2 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
             <span className="truncate pr-2 font-medium" title={files[0].name}>
                {files[0].name}
             </span>
           </div>
            <button onClick={(e) => handleFileRemove(files[0], e)} className="p-1 rounded-full hover:bg-slate-600 transition-colors flex-shrink-0" aria-label={t('form.file.removeFile')}>
                <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
        </div>
    );

    return (
        <div>
            <label className="block mb-2 text-sm font-medium text-slate-300">{label}</label>
            <div
                className={`relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg transition-all duration-300 group ${
                    disabled
                        ? 'bg-slate-800/30 border-slate-700 cursor-not-allowed'
                        : 'border-slate-700 bg-slate-800/50 hover:border-teal-400/70 hover:bg-slate-800 cursor-pointer'
                }`}
                onClick={handleContainerClick}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileAdd}
                    className="hidden"
                    accept={accept}
                    disabled={disabled}
                    multiple={multiple}
                />
                 <div className="relative z-10 w-full text-center">
                    { !multiple && files.length > 0 ? <SingleFileDisplay /> : <DropzoneContent /> }
                </div>
            </div>
            {multiple && files.length > 0 && (
                 <div className="mt-3">
                    <h4 className="text-sm font-semibold text-slate-400 mb-2">{t('form.file.selectedFiles')}</h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {files.map((file, index) => (
                             <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-slate-800/70 p-2 rounded-md text-sm">
                                <span className="text-slate-300 truncate pr-2" title={file.name}>{file.name}</span>
                                <button onClick={(e) => handleFileRemove(file, e)} className="p-1 rounded-full hover:bg-slate-600 transition-colors flex-shrink-0" aria-label={t('form.file.removeFile')}>
                                    <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                                </button>
                             </li>
                        ))}
                    </ul>
                 </div>
            )}
        </div>
    );
};
