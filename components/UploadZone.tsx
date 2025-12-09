import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, AlertCircle, ScanLine } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateAndPassFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError("Please upload an image (JPG, PNG) or PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError("File size exceeds 10MB.");
      return;
    }
    setError(null);
    onFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all duration-200 ease-in-out overflow-hidden
          ${dragActive ? 'border-brand-500 bg-brand-50 shadow-neon' : 'border-slate-300 bg-white hover:bg-slate-50 hover:shadow-neon'}
          ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Scanner Effect Layer */}
        {!isProcessing && !dragActive && (
          <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-500">
             <div className="w-full h-full bg-gradient-to-b from-transparent via-brand-500/5 to-transparent animate-scan"></div>
          </div>
        )}

        <div className="text-center px-4 pointer-events-none z-10 relative">
          {isProcessing ? (
             <div className="flex flex-col items-center animate-pulse">
               <div className="w-12 h-12 bg-brand-200 rounded-full mb-3 flex items-center justify-center">
                  <ScanLine className="text-brand-600 animate-spin" size={24} />
               </div>
               <p className="text-sm text-brand-700 font-medium">Analyzing document...</p>
             </div>
          ) : (
            <>
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${dragActive ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-brand-600'}`}>
                {dragActive ? <ScanLine size={32} /> : <UploadCloud size={32} />}
              </div>
              <p className="text-lg font-medium text-slate-900 mb-1">
                {dragActive ? "Drop to scan" : "Drop your document here"}
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Supports JPG, PNG, PDF
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                <FileText size={12} className="mr-1.5" />
                Forms, Receipts, Invoices
              </span>
            </>
          )}
        </div>

        {/* File Input - Placed last with z-index to ensure clickability */}
        <input 
          type="file" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
          onChange={handleChange}
          accept="image/*,application/pdf"
          disabled={isProcessing}
        />
      </div>
      
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center animate-fadeIn shadow-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};