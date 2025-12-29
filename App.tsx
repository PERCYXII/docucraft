
import React, { useState, useEffect, useRef } from 'react';
import { FileText, PlusCircle, Printer, Layout, Briefcase, Settings, ChevronRight, Loader2, Save, Trash2, DatabaseZap, AlertCircle, Edit3, Eye, Sparkles, Send, CheckCircle2, Upload, X, FileUp, Image as ImageIcon, History, RotateCcw, Clock, ArrowLeft, Download } from 'lucide-react';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { DocType, DocumentData, ProjectInputs, Attachment } from './types';
import { generateDocument, refineDocument } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import Letterhead from './components/Letterhead';
import MermaidDiagram from './components/MermaidDiagram';

// Configure marked with syntax highlighting
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

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
  const [showHistory, setShowHistory] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [history, setHistory] = useState<DocumentData[]>([]);
  const [revisions, setRevisions] = useState<DocumentData[]>([]);
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

  // When currentDoc changes, fetch its revisions
  useEffect(() => {
    if (currentDoc?.rootId) {
      fetchRevisions(currentDoc.rootId);
    } else {
      setRevisions([]);
    }
  }, [currentDoc?.rootId]);

  const fetchHistory = async () => {
    if (!supabase) return;
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        // Group by root_id and take the most recent version of each
        const uniqueDocs: Record<string, any> = {};
        data.forEach(item => {
          const rId = item.root_id || item.id;
          if (!uniqueDocs[rId]) {
            uniqueDocs[rId] = item;
          }
        });

        const formattedData: DocumentData[] = Object.values(uniqueDocs).map(item => ({
          id: item.id,
          rootId: item.root_id || item.id,
          type: item.type as DocType,
          projectName: item.project_name,
          clientName: item.client_name,
          author: item.author,
          date: new Date(item.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
          }),
          content: item.content,
          diagramCode: item.diagram_code,
          createdAt: item.created_at
        }));
        setHistory(formattedData);
      }
    } catch (err: any) {
      console.error("Error fetching history:", err);
      setDbError(err.message || "Failed to connect to database");
    }
  };

  const fetchRevisions = async (rootId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('root_id', rootId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setRevisions(data.map(item => ({
          id: item.id,
          rootId: item.root_id,
          type: item.type as DocType,
          projectName: item.project_name,
          clientName: item.client_name,
          author: item.author,
          date: new Date(item.created_at).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          content: item.content,
          diagramCode: item.diagram_code,
          createdAt: item.created_at
        })));
      }
    } catch (err) {
      console.error("Error fetching revisions:", err);
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
    if (file.size > 4 * 1024 * 1024) {
      alert("File size must be less than 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const data = base64Data.split(',')[1];
      setInputs({ ...inputs, attachment: { data, mimeType: file!.type, name: file!.name } });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setInputs({ ...inputs, attachment: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerSaveNotification = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
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

        if (!error && data && data[0]) {
          const firstId = data[0].id;
          // Set initial root_id to its own ID
          await supabase.from('documents').update({ root_id: firstId }).eq('id', firstId);
          
          newDocData.id = firstId;
          newDocData.rootId = firstId;
          triggerSaveNotification();
          fetchHistory();
        } else if (error) {
          console.error("Supabase Save Error:", error);
        }
        setIsSaving(false);
      }

      setCurrentDoc(newDocData);
      setIsEditing(false);
    } catch (error: any) {
      console.error("Generation failed:", error);
      
      // Check if it's a rate limit error
      if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        alert("⏳ Rate limit reached. The system will automatically retry. Please wait a moment and try again.");
      } else if (error?.message?.includes('Failed after')) {
        alert("❌ Service temporarily unavailable after multiple retries. Please wait a minute and try again.");
      } else {
        alert("Technical synthesis failed. Please check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!currentDoc || !refinePrompt) return;

    setIsRefining(true);
    try {
      const result = await refineDocument(currentDoc.content, currentDoc.diagramCode || '', refinePrompt);
      const updatedDoc: DocumentData = {
        ...currentDoc,
        content: result.content,
        diagramCode: result.diagramCode
      };
      
      if (supabase && currentDoc.rootId) {
        // ALWAYS Insert as a new version automatically
        const { data, error } = await supabase
          .from('documents')
          .insert([{
            root_id: currentDoc.rootId,
            type: updatedDoc.type,
            project_name: updatedDoc.projectName,
            client_name: updatedDoc.clientName,
            author: updatedDoc.author,
            content: updatedDoc.content,
            diagram_code: updatedDoc.diagramCode
          }])
          .select();
        
        if (!error && data && data[0]) {
          updatedDoc.id = data[0].id;
          triggerSaveNotification();
          fetchHistory();
        }
      }

      setCurrentDoc(updatedDoc);
      setRefinePrompt('');
      setIsEditing(false);
    } catch (error: any) {
      console.error("Refinement failed:", error);
      
      // Check if it's a rate limit error
      if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        alert("⏳ Rate limit reached. The system will automatically retry. Please wait a moment and try again.");
      } else if (error?.message?.includes('Failed after')) {
        alert("❌ Service temporarily unavailable after multiple retries. Please wait a minute and try again.");
      } else {
        alert("Architecture adjustment failed. Please try again.");
      }
    } finally {
      setIsRefining(false);
    }
  };

  const handleManualSave = async () => {
    if (!currentDoc || !supabase) return;
    
    setIsSaving(true);
    try {
      const payload = {
        root_id: currentDoc.rootId,
        type: currentDoc.type,
        project_name: currentDoc.projectName,
        client_name: currentDoc.clientName,
        author: currentDoc.author,
        content: currentDoc.content,
        diagram_code: currentDoc.diagramCode
      };

      const { data, error } = await supabase.from('documents').insert([payload]).select();

      if (error) throw error;
      
      if (data && data[0]) {
        setCurrentDoc({
          ...currentDoc,
          id: data[0].id
        });
      }

      triggerSaveNotification();
      fetchHistory();
    } catch (err: any) {
      console.error("Error saving:", err);
      alert(`Vault commit failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (rootId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supabase) return;
    if (!confirm("Wipe this project and all its version history from the vault?")) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('root_id', rootId);

      if (error) throw error;
      
      if (currentDoc?.rootId === rootId) setCurrentDoc(null);
      fetchHistory();
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Wipe failed: ${err.message}`);
    }
  };

  const handlePrint = () => { window.print(); };

  const handleReset = () => {
    setCurrentDoc(null);
    setIsEditing(false);
    setShowHistory(false);
    setInputs({
      type: DocType.PLAYBOOK,
      projectName: '',
      clientName: '',
      author: '',
      description: ''
    });
  };

  const renderMarkdown = (content: string) => {
    const html = marked.parse(content) as string;
    return { __html: html };
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Toast Notification */}
      {saveSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 no-print">
          <div className="bg-emerald-500/20 p-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-sm font-bold tracking-tight">Changes secured to technical vault</p>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-[#0a0f1d] text-slate-300 p-6 flex-shrink-0 flex flex-col no-print border-r border-slate-800">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/40">
            <Layout className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter leading-none">DOCUCRAFT</h1>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-[0.2em] mt-1">Professional Suite</p>
          </div>
        </div>

        <nav className="space-y-1 flex-grow overflow-y-auto custom-scrollbar pr-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 pl-4">Engineering Hub</p>
          <button 
            onClick={handleReset}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${!currentDoc ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/30' : 'hover:bg-slate-800/50 text-slate-400'}`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-bold text-sm">New Initiative</span>
          </button>
          
          <div className="mt-12">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 pl-4">Project Archives</p>
            {dbError ? (
              <div className="px-4 py-5 bg-red-950/20 rounded-2xl border border-red-900/30">
                <p className="text-xs text-red-400 font-bold flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4" /> Vault Offline</p>
                <button onClick={fetchHistory} className="w-full text-[10px] bg-red-900/40 text-red-100 py-2.5 rounded-xl font-black uppercase tracking-widest hover:bg-red-800/50 transition-colors">Reconnect</button>
              </div>
            ) : history.length === 0 ? (
              <div className="px-4 py-10 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                <p className="text-sm text-slate-600 italic">No archived documents</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(doc => (
                  <button 
                    key={doc.rootId}
                    onClick={() => {
                      setCurrentDoc(doc);
                      setIsEditing(false);
                      setShowHistory(false);
                    }}
                    className={`group w-full text-left flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all border ${currentDoc?.rootId === doc.rootId ? 'bg-slate-800 border-blue-500/50 text-white' : 'hover:bg-slate-800/40 border-transparent text-slate-400'}`}
                  >
                    <div className="overflow-hidden">
                       <p className="font-bold text-sm truncate">{doc.projectName}</p>
                       <p className="text-[10px] opacity-50 font-mono mt-0.5">{doc.type}</p>
                    </div>
                    <div className="flex items-center">
                       <Trash2 
                          onClick={(e) => handleDelete(doc.rootId!, e)}
                          className="w-4 h-4 ml-3 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all transform hover:scale-110" 
                        />
                       <ChevronRight className={`w-4 h-4 ml-1 transition-transform duration-300 ${currentDoc?.rootId === doc.rootId ? 'translate-x-1 text-blue-400' : 'opacity-20'}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800/50">
          <div className="flex items-center gap-4 p-4 bg-slate-900/80 rounded-2xl border border-slate-800/50">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-inner ${isSupabaseConfigured && !dbError ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}><DatabaseZap className="w-6 h-6" /></div>
            <div className="overflow-hidden">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">Storage Status</p>
              <p className="text-xs font-bold text-white truncate">{isSupabaseConfigured ? (dbError ? 'Offline' : 'Encrypted Cloud') : 'Standalone'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-12 relative bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {!currentDoc ? (
            /* Creation Form */
            <section className="bg-white rounded-[40px] border border-slate-200 shadow-2xl p-10 md:p-16 animate-in fade-in slide-in-from-bottom-8 duration-700 no-print relative overflow-hidden">
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60"></div>
              
              <div className="mb-14 relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-12 bg-blue-600 rounded-full"></div>
                  <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.3em]">Module Generation 01</p>
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Generate Technical Logic</h2>
                <p className="text-slate-500 text-lg">Initialize professional engineering documentation from structured requirements.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 relative z-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-blue-600" /> Template Structure</label>
                  <select value={inputs.type} onChange={e => setInputs({...inputs, type: e.target.value as DocType})} className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                    {Object.values(DocType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-blue-600" /> Project Identifier</label>
                  <input type="text" value={inputs.projectName} onChange={e => setInputs({...inputs, projectName: e.target.value})} placeholder="X-Initiative Name" className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Target Organization</label>
                  <input type="text" value={inputs.clientName} onChange={e => setInputs({...inputs, clientName: e.target.value})} placeholder="Client Entity" className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Responsible Architect</label>
                  <input type="text" value={inputs.author} onChange={e => setInputs({...inputs, author: e.target.value})} placeholder="Lead Engineer" className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operational Scope & Constraints</label>
                  <textarea rows={5} value={inputs.description} onChange={e => setInputs({...inputs, description: e.target.value})} placeholder="Detailed project breakdown, technology stack, security requirements, and milestones..." className="w-full px-6 py-4 rounded-3xl border border-slate-200 bg-slate-50/50 resize-none font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"></textarea>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-3">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><FileUp className="w-3.5 h-3.5 text-blue-600" /> Technical Reference Assets</label>
                  {inputs.attachment ? (
                    <div className="flex items-center justify-between p-5 bg-blue-50 border border-blue-100 rounded-3xl animate-in zoom-in duration-300">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">{inputs.attachment.mimeType.startsWith('image/') ? <ImageIcon className="w-6 h-6 text-white" /> : <FileText className="w-6 h-6 text-white" />}</div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{inputs.attachment.name}</p>
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Asset Attached</p>
                        </div>
                      </div>
                      <button onClick={removeAttachment} className="p-3 hover:bg-red-50 hover:text-red-500 rounded-full text-blue-400 transition-colors"><X className="w-6 h-6" /></button>
                    </div>
                  ) : (
                    <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleFileChange} onClick={() => fileInputRef.current?.click()} className={`relative group cursor-pointer border-2 border-dashed rounded-[32px] p-10 transition-all flex flex-col items-center justify-center gap-4 ${isDragging ? 'border-blue-600 bg-blue-50 scale-[0.99]' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf,.doc,.docx" />
                      <div className={`p-5 rounded-3xl transition-all shadow-lg ${isDragging ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:shadow-blue-500/10'}`}><Upload className="w-8 h-8" /></div>
                      <div className="text-center">
                        <p className="text-sm font-black text-slate-900">Drop Architecture Sketches</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">PDF, DOCX, or IMAGES up to 4MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-16 flex justify-end">
                <button onClick={handleGenerate} disabled={isLoading} className="bg-slate-900 hover:bg-blue-600 text-white font-black py-6 px-14 rounded-3xl flex items-center gap-4 transition-all disabled:opacity-50 shadow-2xl shadow-slate-900/20 active:scale-95 group">
                  {isLoading ? <><Loader2 className="w-6 h-6 animate-spin" /> Synthesizing Logic...</> : <><Sparkles className="w-6 h-6 text-blue-400 group-hover:text-white" /> Generate & Archive</>}
                </button>
              </div>
            </section>
          ) : (
            /* Document Preview & Tools */
            <div className="animate-in fade-in slide-in-from-top-4 duration-700">
              {/* Contextual Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print sticky top-0 z-40 bg-slate-50/90 backdrop-blur-xl py-6 px-2">
                <div className="flex items-center gap-3">
                  <button onClick={handleReset} className="bg-white hover:bg-slate-100 text-slate-900 px-5 py-3 rounded-2xl border border-slate-200 shadow-sm font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95"><ArrowLeft className="w-4 h-4" /> Exit</button>
                  <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                  <button onClick={() => setIsEditing(!isEditing)} className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 px-5 py-3 rounded-2xl border shadow-sm transition-all active:scale-95 ${isEditing ? 'bg-slate-900 text-white border-slate-900 shadow-slate-900/20' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-500 hover:text-blue-600'}`}>
                    {isEditing ? <><Eye className="w-4 h-4" /> Preview</> : <><Edit3 className="w-4 h-4" /> Mod Edit</>}
                  </button>
                  <button onClick={() => setShowHistory(!showHistory)} className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 px-5 py-3 rounded-2xl border shadow-sm transition-all active:scale-95 ${showHistory ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-500 hover:text-amber-600'}`}>
                    <Clock className="w-4 h-4" /> Log ({revisions.length})
                  </button>
                </div>
                <div className="flex gap-3">
                  {isEditing && (
                    <button onClick={handleManualSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Commit Revision
                    </button>
                  )}
                  <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"><Download className="w-4 h-4" /> PDF Release</button>
                </div>
              </div>

              {/* Version Browser */}
              {showHistory && (
                <div className="mb-8 bg-white rounded-[32px] p-8 border border-slate-200 shadow-2xl animate-in slide-in-from-top-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-500/10 p-2 rounded-xl"><History className="w-6 h-6 text-amber-600" /></div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Revision Protocol</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Select logic state to load</p>
                      </div>
                    </div>
                    <button onClick={() => setShowHistory(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                    {revisions.map((rev, idx) => (
                      <div key={rev.id} onClick={() => setCurrentDoc(rev)} className={`group cursor-pointer p-5 rounded-2xl border transition-all duration-300 ${currentDoc?.id === rev.id ? 'bg-slate-900 border-slate-900 text-white scale-[1.02] shadow-xl' : 'bg-slate-50 border-slate-100 hover:border-amber-300'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${currentDoc?.id === rev.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>VER. {revisions.length - idx}</span>
                          {currentDoc?.id === rev.id && <RotateCcw className="w-4 h-4 text-blue-400 animate-pulse" />}
                        </div>
                        <p className={`text-sm font-black truncate mb-1 ${currentDoc?.id === rev.id ? 'text-white' : 'text-slate-900'}`}>{rev.projectName}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${currentDoc?.id === rev.id ? 'text-slate-400' : 'text-slate-500'}`}>{rev.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Refinement Panel */}
              <div className="mb-10 bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-slate-800 no-print relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-700 pointer-events-none"></div>
                <div className="flex items-center gap-3 mb-5 px-2">
                  <div className="bg-blue-600/20 p-1.5 rounded-lg"><Sparkles className="w-5 h-5 text-blue-400" /></div>
                  <div>
                    <span className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Neural Architect Assistant</span>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Adjust logic or add technical sections</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={refinePrompt} 
                    onChange={(e) => setRefinePrompt(e.target.value)} 
                    placeholder="e.g. Expand on security protocols, add Kubernetes config..." 
                    className="flex-1 bg-slate-800/80 border border-slate-700/50 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none placeholder:text-slate-600 font-medium transition-all" 
                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()} 
                  />
                  <button onClick={handleRefine} disabled={isRefining || !refinePrompt} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-[0.1em] transition-all disabled:opacity-50 shadow-xl shadow-blue-600/20 active:scale-95">
                    {isRefining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Apply Changes
                  </button>
                </div>
              </div>

              {/* Physical Document Page */}
              <div className="bg-white p-[1.5cm] md:p-[2.5cm] min-h-[29.7cm] shadow-2xl border border-slate-200 rounded-sm letterhead-page mb-24 relative selection:bg-blue-100">
                <Letterhead projectName={currentDoc.projectName} clientName={currentDoc.clientName} author={currentDoc.author} date={currentDoc.date} docType={currentDoc.type} />
                
                <div className="mt-20 text-slate-800 leading-relaxed space-y-12">
                  {isEditing ? (
                    <div className="space-y-8 no-print animate-in slide-in-from-left-4 duration-500">
                       <div className="relative">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 pl-2">System Content Logic (Markdown)</label>
                         <textarea className="w-full min-h-[700px] p-10 font-mono text-sm bg-slate-50 border border-slate-100 rounded-[32px] focus:ring-2 focus:ring-blue-600 shadow-inner outline-none leading-relaxed transition-all" value={currentDoc.content} onChange={(e) => setCurrentDoc({...currentDoc, content: e.target.value})} />
                       </div>
                       <div className="relative">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 pl-2">Workflow Schematic (Mermaid.js)</label>
                         <textarea className="w-full min-h-[250px] p-8 font-mono text-xs bg-[#0f172a] text-emerald-400 border border-slate-800 rounded-[32px] focus:ring-2 focus:ring-emerald-500 outline-none leading-relaxed shadow-2xl" value={currentDoc.diagramCode || ''} onChange={(e) => setCurrentDoc({...currentDoc, diagramCode: e.target.value})} />
                       </div>
                    </div>
                  ) : (
                    <article className="animate-in fade-in duration-700">
                      <div className="prose prose-slate prose-lg max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight prose-a:text-blue-600 prose-img:rounded-3xl" dangerouslySetInnerHTML={renderMarkdown(currentDoc.content)} />
                      
                      {currentDoc.diagramCode && (
                        <div className="mt-24 pt-16 border-t border-slate-100 relative">
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Structural Topology</h3>
                          </div>
                          <div className="p-10 bg-slate-50 rounded-[40px] border border-slate-100 shadow-inner"><MermaidDiagram chart={currentDoc.diagramCode} /></div>
                          <div className="mt-8 flex justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-widest px-4">
                             <p>Reference-ID: {currentDoc.id}</p>
                             <p>Auth-Root: {currentDoc.rootId}</p>
                          </div>
                        </div>
                      )}
                    </article>
                  )}
                </div>

                {/* Footer / Signature */}
                <footer className="mt-40 pt-16 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center md:items-end gap-12 pb-10">
                   <div className="text-[10px] text-slate-400 uppercase tracking-widest leading-loose text-center md:text-left font-medium">
                     <p className="font-black text-slate-600 mb-2">INFRASTRUX SOLUTIONS ARCHIVE</p>
                     <p>© 2024 INFRASTRUX SYSTEMS. ALL RIGHTS RESERVED.</p>
                     <p>TECHNICAL CLEARANCE LEVEL: INTERNAL RESTRICTED</p>
                   </div>
                   <div className="text-center md:text-right w-full md:w-auto">
                     <div className="h-24 w-full md:w-64 border-b-2 border-slate-300 mb-4 bg-slate-50/30 flex items-center justify-center italic text-slate-300 font-serif">Digital Signature Required</div>
                     <div className="space-y-1">
                       <p className="text-[11px] text-slate-900 font-black uppercase tracking-[0.2em]">{currentDoc.author || "Lead Architect"}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Authorized Systems Signatory</p>
                     </div>
                   </div>
                </footer>
              </div>
            </div>
          )}
        </div>

        {/* Global Loading Overlay */}
        {(isLoading || isRefining) && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 no-print selection:bg-transparent">
            <div className="bg-slate-900/40 p-16 rounded-[60px] max-w-lg w-full text-center space-y-12 border border-slate-800/50 animate-in zoom-in-95 duration-500 shadow-2xl shadow-blue-900/20">
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-[8px] border-t-blue-500 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-500"><Sparkles className="w-14 h-14 animate-pulse" /></div>
              </div>
              <div>
                <h3 className="text-3xl font-black text-white mb-4 tracking-tight">{isLoading ? 'Synthesizing Architecture' : 'Refining System Logic'}</h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">Accessing Neural Design Matrix...</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(i => <div key={i} className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-600 animate-[loading_2s_infinite]" style={{ animationDelay: `${i * 0.3}s` }}></div></div>)}
              </div>
            </div>
          </div>
        )}
      </main>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
        @media print {
          .letterhead-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 1.5cm !important;
            width: 100% !important;
            min-height: auto !important;
          }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
