import React, { useState, useRef } from 'react';
import { DocumentAnalysis, FieldData } from '../types';
import { 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Edit3, 
  Download,
  Eye,
  Layout,
  Code,
  Mail,
  Phone,
  MapPin,
  Image as ImageIcon,
  CheckSquare,
  XCircle,
  FileDown,
  Trash2,
  Check
} from 'lucide-react';
import { Button } from './Button';
import { jsPDF } from 'jspdf';

interface AnalysisViewProps {
  data: DocumentAnalysis;
  imageUrl?: string;
  onReset: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ data, imageUrl, onReset }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'form' | 'json'>('overview');
  const [fields, setFields] = useState<FieldData[]>(data.fields);
  const [truthLens, setTruthLens] = useState(false);
  
  // Save/Validation State
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Download Generation State
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate stats
  const requiredFields = fields.filter(f => f.required);
  const filledRequired = requiredFields.filter(f => f.status === 'filled' || f.status === 'skipped').length;
  const completionRate = requiredFields.length > 0 
    ? Math.round((filledRequired / requiredFields.length) * 100) 
    : 100;

  const handleFieldChange = (key: string, newValue: string) => {
    setFields(prev => prev.map(f => 
      f.key === key ? { ...f, value: newValue, status: newValue ? 'filled' : 'empty' } : f
    ));
    if (saveMessage) setSaveMessage(null);
  };

  const handleSkipField = (key: string) => {
    setFields(prev => prev.map(f => 
       f.key === key ? { 
         ...f, 
         status: f.status === 'skipped' ? (f.value ? 'filled' : 'empty') : 'skipped' 
       } : f
    ));
  };

  const handleImageUpload = (key: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      handleFieldChange(key, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImageField = (key: string) => {
    handleFieldChange(key, "");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    // Simulate validation process
    await new Promise(resolve => setTimeout(resolve, 800));

    // Validation logic: Check for REQUIRED fields that are EMPTY and NOT SKIPPED
    const stillMissing = fields.filter(f => f.required && f.status === 'empty');

    if (stillMissing.length > 0) {
      setSaveMessage({
        type: 'error',
        text: `Validation Failed: ${stillMissing.length} required field(s) are empty.`
      });
    } else {
      setSaveMessage({
        type: 'success',
        text: 'Form validated and saved successfully!'
      });
    }
    setIsSaving(false);
  };

  const exportJSON = () => {
    const jsonString = JSON.stringify({ ...data, fields }, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `docusight_export_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadFilledDoc = async () => {
    if (!imageUrl) return;
    setIsGeneratingDownload(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not initialized");
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      // Load original image
      const img = new Image();
      img.src = imageUrl;
      // Use a promise to handle load and error explicitly
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load original image"));
      });

      // Set canvas size to match image
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      canvas.width = width;
      canvas.height = height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Draw Fields
      for (const field of fields) {
        if (!field.boundingBox || !field.value || field.status === 'skipped') continue;

        const [ymin, xmin, ymax, xmax] = field.boundingBox;
        const x = xmin * canvas.width;
        const y = ymin * canvas.height;
        const w = (xmax - xmin) * canvas.width;
        const h = (ymax - ymin) * canvas.height;

        if (field.type === 'image' || field.type === 'signature') {
          // Draw Image/Signature
          const fieldImg = new Image();
          fieldImg.src = field.value;
          await new Promise<void>((resolve) => {
             fieldImg.onload = () => resolve();
             fieldImg.onerror = () => resolve(); // Gracefully fail for individual fields
          });
          // Preserve aspect ratio fit within box
          const scale = Math.min(w / fieldImg.naturalWidth, h / fieldImg.naturalHeight);
          const drawW = fieldImg.naturalWidth * scale;
          const drawH = fieldImg.naturalHeight * scale;
          // Center in box
          const drawX = x + (w - drawW) / 2;
          const drawY = y + (h - drawH) / 2;
          
          ctx.drawImage(fieldImg, drawX, drawY, drawW, drawH);

        } else {
          // Draw Text
          // Estimate font size based on box height (approx 60% of height)
          let fontSize = Math.floor(h * 0.6);
          // Clamp font size to reasonable limits
          if (fontSize < 12) fontSize = 12; 
          if (fontSize > 60) fontSize = 60;

          ctx.fillStyle = "#000000"; // Black text
          // Use a monospace-ish font for form filling look
          ctx.font = `${fontSize}px "Courier New", monospace`;
          ctx.textBaseline = 'middle';
          
          // Adjust y to center vertically
          const textY = y + h / 2;
          // Add small padding x
          const textX = x + 5; 

          if (field.type === 'checkbox') {
             const isChecked = field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes' || field.value.toLowerCase() === 'checked';
             if (isChecked) {
                // Draw a checkmark
                ctx.fillText("✓", textX, textY, w - 10);
             }
          } else {
             ctx.fillText(field.value, textX, textY, w - 10);
          }
        }
      }

      // Generate PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.85); // Compress slightly
      
      // FIX: Use positional arguments for jsPDF constructor to avoid "Invalid argument passed to jsPDF.scale"
      // new jsPDF(orientation, unit, format)
      const orientation = width > height ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'px', [width, height]);

      pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
      pdf.save(`filled_document_${Date.now()}.pdf`);

    } catch (e) {
      console.error("Download generation failed", e);
      setSaveMessage({ type: 'error', text: 'Failed to generate PDF. Please try again.' });
    } finally {
      setIsGeneratingDownload(false);
    }
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail size={14} className="text-slate-400" />;
      case 'phone': return <Phone size={14} className="text-slate-400" />;
      case 'address': return <MapPin size={14} className="text-slate-400" />;
      case 'image': 
      case 'signature': return <ImageIcon size={14} className="text-slate-400" />;
      case 'checkbox': return <CheckSquare size={14} className="text-slate-400" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-neon border border-brand-100 overflow-hidden">
      {/* Hidden Canvas for Generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{data.documentType || "Document Analysis"}</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${completionRate === 100 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
               {completionRate}% Complete
             </span>
             {data.securityRisks.length > 0 && (
               <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                 {data.securityRisks.length} Security Risks
               </span>
             )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>New Scan</Button>
          <Button variant="primary" size="sm" icon={<Download />} onClick={exportJSON}>Export Data</Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-brand-500 text-brand-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Layout size={16} /> Overview
          </div>
        </button>
        <button
          onClick={() => setActiveTab('form')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'form' ? 'border-brand-500 text-brand-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Edit3 size={16} /> Digital Form
          </div>
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'json' ? 'border-brand-500 text-brand-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Code size={16} /> JSON Schema
          </div>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-5 rounded-lg border border-brand-100 shadow-neon">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Executive Summary</h3>
              <p className="text-slate-800 leading-relaxed">{data.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Action Items */}
               <div className="bg-white p-5 rounded-lg border border-brand-100 shadow-neon">
                 <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <CheckCircle size={16} /> Action Items
                 </h3>
                 {data.actionableInsights.length > 0 ? (
                   <ul className="space-y-2">
                     {data.actionableInsights.map((item, idx) => (
                       <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                         <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                         {item}
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p className="text-sm text-slate-500 italic">No immediate actions detected.</p>
                 )}
               </div>

               {/* Risks */}
               <div className="bg-white p-5 rounded-lg border border-brand-100 shadow-neon">
                 <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <ShieldAlert size={16} /> Security & PII
                 </h3>
                 {data.securityRisks.length > 0 ? (
                   <ul className="space-y-2">
                     {data.securityRisks.map((item, idx) => (
                       <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                         <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                         {item}
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p className="text-sm text-slate-500 italic">No high-risk PII detected.</p>
                 )}
               </div>
            </div>

            {/* Missing Fields Summary */}
            {data.missingFields.length > 0 && (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-900 shadow-sm">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <AlertTriangle size={18} />
                  Missing Information
                </div>
                <p className="text-sm opacity-90">
                  The following required fields appear to be empty: <span className="font-semibold">{data.missingFields.join(', ')}</span>.
                  Please review the Digital Form tab to fill them.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'form' && (
          <div className="animate-fadeIn pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
              <p className="text-sm text-slate-500">
                Edit extracted values. Fields marked with <span className="text-red-500">*</span> are required.
              </p>
              <div className="flex gap-2">
                 {imageUrl && (
                   <button 
                     onClick={handleDownloadFilledDoc}
                     disabled={isGeneratingDownload}
                     className="text-xs flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                   >
                     {isGeneratingDownload ? (
                       'Generating...'
                     ) : (
                       <><FileDown size={14} /> Download PDF</>
                     )}
                   </button>
                 )}
                 <button 
                   onClick={() => setTruthLens(!truthLens)}
                   className={`text-xs flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border transition-colors ${truthLens ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                   <Eye size={14} /> TruthLens™ {truthLens ? 'On' : 'Off'}
                 </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-brand-100 shadow-neon divide-y divide-slate-100">
              {fields.map((field, idx) => {
                const isMissing = field.required && field.status === 'empty';
                const isSkipped = field.status === 'skipped';
                const Icon = getFieldIcon(field.type);
                
                return (
                  <div key={idx} className={`p-4 transition-colors ${isSkipped ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                         <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                           {field.label} {field.required && <span className="text-red-500" title="Required">*</span>}
                         </label>
                         {Icon && <span className="text-slate-400">{Icon}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Skip Button for Required Fields */}
                        {field.required && (
                          <button 
                            onClick={() => handleSkipField(field.key)}
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded transition-colors ${isSkipped ? 'bg-slate-200 text-slate-700' : 'text-slate-300 hover:text-slate-500'}`}
                            title={isSkipped ? "Include field" : "Skip validation for this field"}
                          >
                            {isSkipped ? "Skipped" : "N/A"}
                          </button>
                        )}
                        
                        {/* Status Badge */}
                        {truthLens && (
                           <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                             isSkipped ? 'bg-slate-200 text-slate-600' :
                             field.status === 'filled' ? 'bg-green-100 text-green-700' : 
                             'bg-amber-100 text-amber-700'
                           }`}>
                             {field.status.toUpperCase()}
                           </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                       <div className="relative flex-1">
                         {/* Render specialized inputs based on type */}
                         {(field.type === 'image' || field.type === 'signature') ? (
                            <div className={`mt-1 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md transition-all 
                              ${field.value ? 'bg-white border-brand-300' : 'bg-slate-50 border-slate-300'}
                            `}>
                               {field.value ? (
                                 <div className="relative w-full">
                                    <img src={field.value} alt={field.label} className="max-h-32 mx-auto object-contain rounded" />
                                    <button 
                                      onClick={() => clearImageField(field.key)}
                                      className="absolute top-0 right-0 -mt-2 -mr-2 bg-white text-red-500 rounded-full p-1 shadow border border-slate-200 hover:bg-red-50"
                                      title="Remove image"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                 </div>
                               ) : (
                                 <div className="space-y-1 text-center">
                                   <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
                                   <div className="flex text-sm text-slate-600 justify-center">
                                     <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-600 hover:text-brand-500 focus-within:outline-none">
                                       <span>Upload {field.type}</span>
                                       <input 
                                          type="file" 
                                          className="sr-only" 
                                          accept="image/png,image/jpeg,image/webp"
                                          onChange={(e) => {
                                            if (e.target.files?.[0]) handleImageUpload(field.key, e.target.files[0]);
                                          }}
                                       />
                                     </label>
                                   </div>
                                   <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
                                 </div>
                               )}
                            </div>
                         ) : field.type === 'checkbox' ? (
                            <div 
                              className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all
                                ${field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes' || field.value.toLowerCase() === 'checked'
                                  ? 'bg-brand-50 border-brand-200' 
                                  : 'bg-white border-slate-200 hover:bg-slate-50'}
                              `}
                              onClick={() => {
                                const isChecked = field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes' || field.value.toLowerCase() === 'checked';
                                handleFieldChange(field.key, isChecked ? 'false' : 'true');
                              }}
                            >
                               <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors 
                                 ${(field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes' || field.value.toLowerCase() === 'checked')
                                   ? 'bg-brand-500 border-brand-500' 
                                   : 'bg-white border-slate-300'}
                               `}>
                                 {(field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes' || field.value.toLowerCase() === 'checked') && (
                                   <Check size={14} className="text-white" strokeWidth={3} />
                                 )}
                               </div>
                               <span className="text-sm font-medium text-slate-700 select-none">
                                 {(field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes' || field.value.toLowerCase() === 'checked') ? 'Selected' : 'Unselected'}
                               </span>
                            </div>
                         ) : field.type === 'text' && field.value.length > 60 ? (
                           <textarea
                             rows={3}
                             value={field.value}
                             onChange={(e) => handleFieldChange(field.key, e.target.value)}
                             placeholder={field.example ? `e.g. ${field.example}` : isMissing ? "Required" : ""}
                             disabled={isSkipped}
                             className={`block w-full rounded-md border shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 transition-all
                               ${isMissing 
                                 ? 'border-amber-300 bg-amber-50 text-amber-900 placeholder-amber-400' 
                                 : 'border-slate-200 bg-brand-50/30 focus:bg-white text-slate-800 placeholder-slate-400'
                               }
                               ${isSkipped ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-100' : ''}
                             `}
                           />
                         ) : (
                           <input 
                             type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                             value={field.value}
                             onChange={(e) => handleFieldChange(field.key, e.target.value)}
                             placeholder={field.example ? `e.g. ${field.example}` : isMissing ? "Required" : ""}
                             disabled={isSkipped}
                             className={`block w-full rounded-md border shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 transition-all
                               ${isMissing 
                                 ? 'border-amber-300 bg-amber-50 text-amber-900 placeholder-amber-400' 
                                 : 'border-slate-200 bg-brand-50/30 focus:bg-white text-slate-800 placeholder-slate-400'
                               }
                               ${isSkipped ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-100' : ''}
                             `}
                           />
                         )}
                         
                         {/* Validation Icon Overlay */}
                         {field.required && !isSkipped && field.type !== 'image' && field.type !== 'signature' && field.type !== 'checkbox' && (
                            <div className="absolute right-3 top-2.5 pointer-events-none">
                               {field.status === 'filled' ? (
                                  <CheckCircle size={16} className="text-green-500" />
                               ) : (
                                  <AlertTriangle size={16} className="text-amber-400" />
                               )}
                            </div>
                         )}
                       </div>

                       {truthLens && field.explanation && (
                         <div className="md:w-1/3 text-xs text-slate-400 italic self-center bg-slate-50 p-2 rounded border border-slate-100">
                           <span className="font-semibold text-slate-500">AI Note:</span> "{field.explanation}"
                         </div>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex items-center justify-end gap-4 border-t border-slate-100 pt-4 bg-white p-4 sticky bottom-0 shadow-lg rounded-t-xl z-10">
              {saveMessage && (
                <span className={`text-sm font-medium animate-fadeIn ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMessage.type === 'success' ? (
                    <span className="flex items-center gap-1"><CheckCircle size={16}/> {saveMessage.text}</span>
                  ) : (
                    <span className="flex items-center gap-1"><XCircle size={16}/> {saveMessage.text}</span>
                  )}
                </span>
              )}
              <Button 
                variant="primary" 
                onClick={handleSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Validating...' : 'Save & Validate Form'}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="relative h-full animate-fadeIn">
            <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-auto h-[600px]">
              {JSON.stringify({ ...data, fields }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};