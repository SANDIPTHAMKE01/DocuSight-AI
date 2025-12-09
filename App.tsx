import React, { useState, useRef } from 'react';
import { UploadZone } from './components/UploadZone';
import { AnalysisView } from './components/AnalysisView';
import { analyzeDocument } from './services/geminiService';
import { AppState, DocumentAnalysis, UploadedFile } from './types';
import { ScanLine, FileText, ChevronRight, Github, RotateCcw } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [analysisData, setAnalysisData] = useState<DocumentAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Create preview URL
    const url = URL.createObjectURL(file);
    setCurrentFile({
      name: file.name,
      type: file.type,
      url,
      base64: "" // handled in service
    });

    setAppState(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      const result = await analyzeDocument(file);
      setAnalysisData(result);
      setAppState(AppState.REVIEW);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to analyze document. Please try again or check your API key.");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setCurrentFile(null);
    setAnalysisData(null);
    setErrorMsg(null);
  };

  const handleSidebarClick = () => {
    if (appState === AppState.IDLE) {
      fileInputRef.current?.click();
    } else {
      handleReset();
    }
  };

  const handleHiddenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation to match UploadZone logic
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert("Please upload an image (JPG, PNG) or PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert("File size exceeds 10MB.");
      return;
    }

    handleFileSelect(file);
    
    // Reset the input so the same file can be selected again if needed
    e.target.value = '';
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Hidden Input for Sidebar Trigger */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,application/pdf"
        onChange={handleHiddenFileInputChange}
      />

      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-20 bg-slate-900 border-r border-slate-800 items-center py-6 gap-6 z-20">
        <button 
          onClick={handleSidebarClick}
          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 group
            ${appState === AppState.IDLE ? 'bg-brand-500 shadow-brand-500/30' : 'bg-slate-800 hover:bg-slate-700'}
          `}
          title={appState === AppState.IDLE ? "Start Scan" : "Reset / Home"}
        >
          <ScanLine 
            className={`transition-colors ${appState === AppState.IDLE ? 'text-white' : 'text-slate-400 group-hover:text-white'} ${appState === AppState.ANALYZING ? 'animate-pulse' : ''}`} 
            size={24} 
          />
        </button>
        
        <div className="flex-1 flex flex-col items-center gap-4 mt-4">
           {/* Additional nav items could go here */}
           {appState === AppState.REVIEW && (
             <button onClick={handleReset} className="p-2 text-slate-500 hover:text-white transition-colors" title="Reset">
               <RotateCcw size={20} />
             </button>
           )}
        </div>
        
        <a href="#" className="p-2 text-slate-500 hover:text-white transition-colors">
          <Github size={20} />
        </a>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Top Bar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-brand-500 rounded-lg text-white shadow-lg shadow-brand-500/20">
                <ScanLine size={16} />
             </div>
             <h1 className="font-capriola font-bold text-xl tracking-wide text-white">DocuSight AI</h1>
          </div>
          <div className="flex items-center gap-4">
             <button className="md:hidden text-slate-400 hover:text-white transition-colors" onClick={handleReset}>
                <RotateCcw size={20} />
             </button>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-hidden relative">
           
           {/* Background Pattern */}
           <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" 
                style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
           </div>

           {appState === AppState.IDLE && (
             <div className="h-full flex flex-col items-center justify-center z-10 relative px-4">
                <div className="max-w-2xl text-center mb-10">
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                    Intelligent Document Processing
                  </h2>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    Upload any form, invoice, or contract. <br/> 
                    DocuSight AI will extract fields, validate data, and explain the content in seconds.
                  </p>
                </div>
                <UploadZone onFileSelect={handleFileSelect} isProcessing={false} />
             </div>
           )}

           {appState === AppState.ANALYZING && currentFile && (
             <div className="h-full flex flex-col md:flex-row p-6 gap-6 items-center justify-center z-10 relative">
               <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
                    <ScanLine className="absolute inset-0 m-auto text-brand-600 animate-pulse" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">Analyzing Document...</h3>
                  <p className="text-slate-500 max-w-sm text-center">
                    Your assistant is reading the layout, extracting fields, and checking for missing information.
                  </p>
               </div>
             </div>
           )}

           {appState === AppState.ERROR && (
             <div className="h-full flex flex-col items-center justify-center z-10 relative px-4">
               <div className="bg-white p-8 rounded-2xl shadow-neon border border-red-100 max-w-md text-center">
                 <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                   <FileText size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-2">Analysis Failed</h3>
                 <p className="text-slate-600 mb-6">{errorMsg || "Something went wrong."}</p>
                 <button 
                   onClick={handleReset}
                   className="w-full py-2 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                 >
                   Try Again
                 </button>
               </div>
             </div>
           )}

           {appState === AppState.REVIEW && currentFile && analysisData && (
             <div className="h-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 z-10 relative">
               
               {/* Left: Document Preview */}
               <div className="flex flex-col h-full bg-slate-200/50 rounded-xl border border-slate-200 overflow-hidden shadow-neon relative group">
                  <div className="absolute top-4 left-4 bg-black/75 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md z-10">
                    Original Document
                  </div>
                  <div className="flex-1 overflow-auto flex items-center justify-center p-8">
                     {currentFile.type === 'application/pdf' ? (
                        <div className="text-center">
                          <FileText size={64} className="text-slate-400 mx-auto mb-4" />
                          <p className="text-slate-500 font-medium">{currentFile.name}</p>
                          <p className="text-xs text-slate-400 mt-1">PDF Preview not available in demo mode</p>
                        </div>
                     ) : (
                        <img 
                          src={currentFile.url} 
                          alt="Doc Preview" 
                          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-[1.01]" 
                        />
                     )}
                  </div>
               </div>

               {/* Right: Analysis Dashboard */}
               <div className="h-full min-h-0">
                 <AnalysisView data={analysisData} imageUrl={currentFile.url} onReset={handleReset} />
               </div>

             </div>
           )}

        </main>
      </div>
    </div>
  );
}