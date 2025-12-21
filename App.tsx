
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, PlusCircle, Printer, Layout, Briefcase, Settings, 
  ChevronRight, Loader2, Save, Trash2, DatabaseZap, AlertCircle, 
  Edit3, Eye, Sparkles, Send, CheckCircle2, Upload, X, FileUp, 
  Image as ImageIcon, History as HistoryIcon, LogOut 
} from 'lucide-react';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { DocType, DocumentData, ProjectInputs, Attachment } from './types';
import { generateDocument, refineDocument } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import Letterhead from './components/Letterhead';
import MermaidDiagram from './MermaidDiagram';

// Configure marked with syntax highlighting
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

// Fix: Corrected App definition to return a JSX element and added default export to resolve index.tsx import error.
const App: React.FC = () => {
  const [inputs, setInputs] = useState<ProjectInputs>({
    type: DocType.PLAYBOOK,
    projectName: '',
    clientName: '',
    author: '',
    description: ''
  });
  
  const [currentDoc, setCurrentDoc] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [history, setHistory] = useState<DocumentData[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from Supabase on mount
  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchHistory();
    }
  }, []);

  const fetchHistory = async () => {
    if (!supabase) return;
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          throw new Error("Table 'documents' not found in public schema.");
        }
        throw new Error(error.message || "Database request failed");
      }
      
      if (data) {
        const formattedData: DocumentData[] = data.map(item => ({
          id: item.id,
          type: item.type as DocType,
          projectName: item.project_name,
          clientName: item.client_name,
          author: item.author,
          date: new Date(item.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
          }),
          content: item.content,
          diagramCode: item.diagram_code
        }));
        setHistory(formattedData);
      }
    } catch (err: any) {
      console.error("Error fetching history:", err);
      setDbError(err.message || "Failed to connect to database");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | null = null;
    
    if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files[0];
      setIsDragging(false);
    } else if (e.target.files) {
      file = e.target.files[0];
    }

    if (!file) return;

    // Check size (max 4MB for safety)
    if (file.size > 4 * 1024 * 1024) {
      alert("File size must be less than 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const data = base64Data.split(',')[1];
      setInputs({
        ...inputs,
        attachment: {
          data,
          mimeType: file!.type,
          name: file!.name
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setInputs({ ...inputs, attachment: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!inputs.projectName || !inputs.description) {
      alert("Please fill in project name and description.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateDocument(inputs);
      const newDocData: DocumentData = {
        id: 'temp-' + Math.random().toString(36).substr(2, 9),
        type: inputs.type,
        projectName: inputs.projectName,
        clientName: inputs.clientName,
        author: inputs.author,
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        }),
        content: result.content,
        diagramCode: result.diagramCode
      };

      if (supabase) {
        setIsSaving(true);
        const { data, error } = await supabase
          .from('documents')
          .insert([{
            type: newDocData.type,
            project_name: newDocData.projectName,
            client_name: newDocData.clientName,
            author: newDocData.author,
            content: newDocData.content,
            diagram_code: newDocData.diagramCode
          }])
          .select();

        if (error) {
          console.warn("Auto-save failed:", error.message);
        } else if (data && data[0]) {
          newDocData.id = data[0].id;
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
          fetchHistory();
        }
        setIsSaving(false);
      }
      setCurrentDoc(newDocData);
    } catch (err) {
      console.error("Generation error:", err);
      alert("Failed to generate document. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!currentDoc || !refinePrompt.trim()) return;
    setIsRefining(true);
    try {
      const result = await refineDocument(currentDoc.content, currentDoc.diagramCode || '', refinePrompt);
      const updatedDoc = {
        ...currentDoc,
        content: result.content,
        diagramCode: result.diagramCode
      };
      setCurrentDoc(updatedDoc);
      setRefinePrompt('');

      if (supabase && updatedDoc.id && !updatedDoc.id.startsWith('temp-')) {
        await supabase
          .from('documents')
          .update({
            content: updatedDoc.content,
            diagram_code: updatedDoc.diagramCode
          })
          .eq('id', updatedDoc.id);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Refinement error:", err);
    } finally {
      setIsRefining(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supabase) return;
    if (!window.confirm("Delete this document permanently?")) return;
    
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      if (currentDoc?.id === id) setCurrentDoc(null);
      fetchHistory();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar: History & Navigation */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 no-print">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <DatabaseZap size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 tracking-tight">INFRASTRUX</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doc Engine v2.0</p>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2 overflow-y-auto flex-1">
          <button 
            onClick={() => setCurrentDoc(null)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${!currentDoc ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-slate-50 text-slate-500'}`}
          >
            <PlusCircle size={18} className={!currentDoc ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'} />
            <span className="font-semibold text-sm">New Project</span>
          </button>

          <div className="mt-6">
            <h3 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <HistoryIcon size={12} />
              Recent Archives
            </h3>
            <div className="space-y-1">
              {history.map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => setCurrentDoc(doc)}
                  className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${currentDoc?.id === doc.id ? 'bg-slate-100 text-slate-900 shadow-inner' : 'hover:bg-slate-50 text-slate-500'}`}
                >
                  <FileText size={16} className={currentDoc?.id === doc.id ? 'text-blue-600' : 'text-slate-300'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{doc.projectName}</p>
                    <p className="text-[10px] opacity-60 truncate">{doc.type}</p>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {history.length === 0 && !dbError && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No history found</p>
                </div>
              )}
              {dbError && (
                <div className="p-4 text-center bg-red-50 rounded-xl border border-red-100">
                  <AlertCircle size={16} className="text-red-500 mx-auto mb-2" />
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">{dbError}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">JS</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">John Smith</p>
              <p className="text-[10px] text-slate-400 truncate">Lead Architect</p>
            </div>
            <LogOut size={14} className="text-slate-300 hover:text-red-500 cursor-pointer" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-white lg:bg-slate-50">
        {!currentDoc ? (
          <div className="max-w-4xl mx-auto px-6 py-12 lg:py-24 animate-in fade-in slide-in-from-bottom-4 duration-700 no-print">
            <div className="bg-white rounded-[2.5rem] p-10 lg:p-16 shadow-2xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-12">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">
                  <Sparkles size={12} /> New Generation
                </span>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Draft New Documentation</h1>
                <p className="text-slate-500 text-lg leading-relaxed">Fill out the project metadata to initiate the AI-driven architectural drafting process.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Document Framework</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(DocType).map((type) => (
                        <button
                          key={type}
                          onClick={() => setInputs({ ...inputs, type })}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all text-left ${inputs.type === type ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Project Identifier</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Project Helios Expansion"
                      value={inputs.projectName}
                      onChange={(e) => setInputs({ ...inputs, projectName: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Client Entity</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Acme Corp Industries"
                      value={inputs.clientName}
                      onChange={(e) => setInputs({ ...inputs, clientName: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Author Credit</label>
                    <input 
                      type="text" 
                      placeholder="Your Name"
                      value={inputs.author}
                      onChange={(e) => setInputs({ ...inputs, author: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Technical Briefing</label>
                    <textarea 
                      placeholder="Describe the scope, constraints, and requirements..."
                      value={inputs.description}
                      onChange={(e) => setInputs({ ...inputs, description: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all font-semibold h-[180px] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Attachment Zone */}
              <div 
                className={`mb-10 p-8 rounded-[2rem] border-2 border-dashed transition-all duration-300 relative group ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50/30 hover:border-blue-300'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileChange}
              >
                {!inputs.attachment ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                      <FileUp size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">Append Architectural References</p>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">JPG, PNG, PDF (Max 4MB)</p>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest"
                    >
                      Browse Files
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*,application/pdf" 
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-6 p-2">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                      <ImageIcon size={28} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-slate-800 truncate">{inputs.attachment.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{inputs.attachment.mimeType}</p>
                    </div>
                    <button 
                      onClick={removeAttachment}
                      className="p-3 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-100 shadow-sm"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white font-black py-5 rounded-2xl transition-all duration-300 shadow-xl shadow-slate-200 flex items-center justify-center gap-4 text-lg uppercase tracking-widest group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Synthesizing Architecture...
                  </>
                ) : (
                  <>
                    Initialize Engine
                    <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            {/* Toolbar */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 no-print">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentDoc(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <div>
                  <h2 className="font-black text-slate-900 uppercase tracking-tighter text-sm">{currentDoc.projectName}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{currentDoc.type}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentDoc.date}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 animate-in fade-out fill-mode-forwards delay-2000">
                    <CheckCircle2 size={12} /> Sync Complete
                  </span>
                )}
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${isEditing ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}
                >
                  {isEditing ? <Eye size={16} /> : <Edit3 size={16} />}
                  {isEditing ? 'Preview Mode' : 'Direct Edit'}
                </button>
                <button 
                  onClick={handlePrint}
                  className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:border-slate-400 rounded-xl transition-all shadow-sm"
                  title="Print Document"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>

            {/* Document Surface */}
            <div className="max-w-[850px] mx-auto my-12 print:my-0 print:max-w-full">
              <div className="bg-white shadow-2xl shadow-slate-200 p-12 lg:p-20 border border-slate-100 print:shadow-none print:border-none print:p-0 rounded-[3rem] print:rounded-none">
                <Letterhead 
                  projectName={currentDoc.projectName}
                  clientName={currentDoc.clientName}
                  author={currentDoc.author}
                  date={currentDoc.date}
                  docType={currentDoc.type}
                />
                
                {isEditing ? (
                  <div className="space-y-8 no-print">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Markdown Content</label>
                      <textarea 
                        value={currentDoc.content}
                        onChange={(e) => setCurrentDoc({ ...currentDoc, content: e.target.value })}
                        className="w-full min-h-[500px] p-8 bg-slate-50 rounded-[2rem] border-none font-mono text-sm leading-relaxed focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mermaid Script</label>
                      <textarea 
                        value={currentDoc.diagramCode || ''}
                        onChange={(e) => setCurrentDoc({ ...currentDoc, diagramCode: e.target.value })}
                        className="w-full h-[200px] p-8 bg-slate-50 rounded-[2rem] border-none font-mono text-sm leading-relaxed focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <article className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-a:text-blue-600">
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(currentDoc.content) }} />
                    {currentDoc.diagramCode && (
                      <MermaidDiagram chart={currentDoc.diagramCode} />
                    )}
                  </article>
                )}

                {/* Refinement Interface */}
                {!isEditing && (
                  <div className="mt-20 pt-12 border-t border-slate-100 no-print">
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                      <div className="flex items-center gap-2 mb-6">
                        <Sparkles size={16} className="text-blue-600" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">AI Content Refinement</h3>
                      </div>
                      <div className="relative">
                        <textarea 
                          placeholder="e.g. Expand the technical breakdown section or add more detail to the security protocols..."
                          value={refinePrompt}
                          onChange={(e) => setRefinePrompt(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-5 pr-16 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm min-h-[100px] resize-none shadow-sm"
                        />
                        <button 
                          onClick={handleRefine}
                          disabled={isRefining || !refinePrompt.trim()}
                          className="absolute bottom-4 right-4 bg-slate-900 text-white p-3 rounded-xl hover:bg-blue-600 disabled:bg-slate-200 transition-all shadow-lg"
                        >
                          {isRefining ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                      </div>
                      <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Refinement updates the content and diagram in real-time</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
