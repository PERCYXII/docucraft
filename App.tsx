
import React, { useState, useEffect, useRef } from 'react';
import { FileText, PlusCircle, Printer, Layout, Briefcase, Settings, ChevronRight, Loader2, Save, Trash2, DatabaseZap, AlertCircle, Edit3, Eye, Sparkles, Send, CheckCircle2, Upload, X, FileUp, Image as ImageIcon } from 'lucide-react';
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
      setIsEditing(false);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate document. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!currentDoc || !refinePrompt) return;

    setIsRefining(true);
    try {
      const result = await refineDocument(currentDoc.content, currentDoc.diagramCode || '', refinePrompt);
      const updatedDoc = {
        ...currentDoc,
        content: result.content,
        diagramCode: result.diagramCode
      };
      
      if (supabase && !currentDoc.id.startsWith('temp')) {
        const { error } = await supabase
          .from('documents')
          .update({
            content: updatedDoc.content,
            diagram_code: updatedDoc.diagramCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentDoc.id);
        
        if (!error) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
          fetchHistory();
        }
      }

      setCurrentDoc(updatedDoc);
      setRefinePrompt('');
      setIsEditing(false);
    } catch (error) {
      console.error("Refinement failed:", error);
      alert("Adjustment failed.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleManualSave = async () => {
    if (!currentDoc || !supabase) return;
    
    setIsSaving(true);
    try {
      const payload = {
        type: currentDoc.type,
        project_name: currentDoc.projectName,
        client_name: currentDoc.clientName,
        author: currentDoc.author,
        content: currentDoc.content,
        diagram_code: currentDoc.diagramCode,
        updated_at: new Date().toISOString()
      };

      let response;
      if (currentDoc.id.startsWith('temp')) {
        response = await supabase.from('documents').insert([payload]).select();
      } else {
        response = await supabase.from('documents').update(payload).eq('id', currentDoc.id).select();
      }

      if (response.error) throw response.error;
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchHistory();
      
      if (response.data && response.data[0]) {
        setCurrentDoc({
          ...currentDoc,
          id: response.data[0].id
        });
      }
    } catch (err: any) {
      console.error("Error saving:", err);
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supabase) return;
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      if (currentDoc?.id === id) setCurrentDoc(null);
      fetchHistory();
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setCurrentDoc(null);
    setIsEditing(false);
    setInputs({
      type: DocType.PLAYBOOK,
      projectName: '',
      clientName: '',
      author: '',
      description: ''
    });
  };

  const renderMarkdown = (content: string) => {
    // In marked v15, parse is the main entry point. Extensions are already applied globally.
    const html = marked.parse(content);
    return { __html: html };
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-80 bg-slate-900 text-slate-300 p-6 flex-shrink-0 flex flex-col no-print border-r border-slate-800">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Layout className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">DocuCraft <span className="text-blue-500 font-light">Pro</span></h1>
        </div>

        <nav className="space-y-1 flex-grow overflow-y-auto custom-scrollbar">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Creation Hub</p>
          <button 
            onClick={handleReset}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${!currentDoc ? 'bg-slate-800 text-white shadow-lg' : 'hover:bg-slate-800/50'}`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-medium">New Document</span>
          </button>
          
          <div className="mt-10">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Vaulted Documents</p>
            {dbError ? (
              <div className="px-4 py-4 bg-red-900/10 rounded-xl border border-red-900/30">
                <p className="text-xs text-red-400 font-bold flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4" /> Connection Issue
                </p>
                <p className="text-[10px] text-red-300/80 leading-relaxed mb-3">
                  {dbError}
                </p>
                <button 
                  onClick={fetchHistory}
                  className="w-full text-[10px] bg-red-900/40 text-red-200 py-2 rounded-lg hover:bg-red-900/60 transition-all font-bold"
                >
                  Refresh
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="px-4 py-8 text-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                <p className="text-sm text-slate-600 italic">Vault is empty</p>
              </div>
            ) : (
              <div className="space-y-1">
                {history.map(doc => (
                  <button 
                    key={doc.id}
                    onClick={() => {
                      setCurrentDoc(doc);
                      setIsEditing(false);
                    }}
                    className={`group w-full text-left flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm ${currentDoc?.id === doc.id ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'hover:bg-slate-800 text-slate-400'}`}
                  >
                    <span className="truncate flex-1 font-medium">{doc.projectName}</span>
                    <div className="flex items-center">
                       <Trash2 
                          onClick={(e) => handleDelete(doc.id, e)}
                          className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all transform hover:scale-110" 
                        />
                       <ChevronRight className="w-4 h-4 opacity-50 ml-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/30">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${isSupabaseConfigured && !dbError ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500'}`}>
              <DatabaseZap className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Database</p>
              <p className="text-xs font-medium text-white truncate">
                {isSupabaseConfigured ? (dbError ? 'Offline' : 'Supabase Active') : 'Unconfigured'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 relative bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {!currentDoc ? (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-10 transition-all animate-in fade-in slide-in-from-bottom-8 duration-700 no-print">
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Technical Document Generator</h2>
                <p className="text-slate-500">Automate high-quality engineering documentation with AI precision.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-3 h-3 text-blue-600" /> Template
                  </label>
                  <select 
                    value={inputs.type}
                    onChange={e => setInputs({...inputs, type: e.target.value as DocType})}
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/50 transition-all font-medium appearance-none cursor-pointer"
                  >
                    {Object.values(DocType).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase className="w-3 h-3 text-blue-600" /> Project Title
                  </label>
                  <input 
                    type="text"
                    value={inputs.projectName}
                    onChange={e => setInputs({...inputs, projectName: e.target.value})}
                    placeholder="Project Name"
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/50 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Client Organization</label>
                  <input 
                    type="text"
                    value={inputs.clientName}
                    onChange={e => setInputs({...inputs, clientName: e.target.value})}
                    placeholder="Client Name"
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/50 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Author / Lead Engineer</label>
                  <input 
                    type="text"
                    value={inputs.author}
                    onChange={e => setInputs({...inputs, author: e.target.value})}
                    placeholder="Author Name"
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/50 transition-all font-medium"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scope & Requirements</label>
                  <textarea 
                    rows={4}
                    value={inputs.description}
                    onChange={e => setInputs({...inputs, description: e.target.value})}
                    placeholder="Provide technical details, tools, and deliverables..."
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/50 transition-all resize-none font-medium"
                  ></textarea>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <FileUp className="w-3 h-3 text-blue-600" /> Technical Attachments (Images/Docs)
                  </label>
                  
                  {inputs.attachment ? (
                    <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in zoom-in duration-300">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                          {inputs.attachment.mimeType.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] md:max-w-md">{inputs.attachment.name}</p>
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Ready for AI processing</p>
                        </div>
                      </div>
                      <button 
                        onClick={removeAttachment}
                        className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleFileChange}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center gap-3 ${isDragging ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept="image/*,application/pdf,.doc,.docx"
                      />
                      <div className={`p-4 rounded-full transition-all ${isDragging ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-900">Upload Reference Material</p>
                        <p className="text-xs text-slate-500 mt-1">Drag and drop or click to upload (Max 4MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 flex justify-end">
                <button 
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="bg-slate-900 hover:bg-blue-600 text-white font-bold py-5 px-12 rounded-2xl flex items-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-blue-500/20 group"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-6 h-6" />
                      Generate & Save
                    </>
                  )}
                </button>
              </div>
            </section>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md py-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleReset}
                    className="bg-white hover:bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 font-bold text-sm"
                  >
                    <PlusCircle className="w-4 h-4" /> New
                  </button>
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`text-sm font-bold flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm transition-all ${isEditing ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}
                  >
                    {isEditing ? <><Eye className="w-4 h-4" /> Preview</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                  </button>
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-2 rounded-full border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Synced to DB
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {isEditing && (
                    <button 
                      onClick={handleManualSave}
                      disabled={isSaving}
                      className="bg-white hover:bg-slate-50 text-slate-900 px-5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-2 text-sm font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Database
                    </button>
                  )}
                  <button 
                    onClick={handlePrint}
                    className="bg-slate-900 hover:bg-blue-600 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-xl"
                  >
                    <Printer className="w-4 h-4" /> Print / PDF
                  </button>
                </div>
              </div>

              <div className="mb-10 bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-800 no-print">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Refinement Assistant</span>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder="e.g. Integrate Docker setup instructions..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                  />
                  <button 
                    onClick={handleRefine}
                    disabled={isRefining || !refinePrompt}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Apply
                  </button>
                </div>
              </div>

              <div className="bg-white p-[1.5cm] md:p-[2.5cm] min-h-[29.7cm] shadow-2xl border border-slate-200 rounded-xl letterhead-page mb-24 relative">
                <Letterhead 
                  projectName={currentDoc.projectName}
                  clientName={currentDoc.clientName}
                  author={currentDoc.author}
                  date={currentDoc.date}
                  docType={currentDoc.type}
                />
                
                <div className="mt-16 text-slate-800 leading-relaxed space-y-8">
                  {isEditing ? (
                    <div className="space-y-6 no-print">
                       <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Content (Markdown)</label>
                         <textarea 
                            className="w-full min-h-[600px] p-8 font-mono text-sm bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                            value={currentDoc.content}
                            onChange={(e) => setCurrentDoc({...currentDoc, content: e.target.value})}
                         />
                       </div>
                       
                       <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Workflow Logic (Mermaid)</label>
                         <textarea 
                            className="w-full min-h-[180px] p-6 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={currentDoc.diagramCode || ''}
                            onChange={(e) => setCurrentDoc({...currentDoc, diagramCode: e.target.value})}
                         />
                       </div>
                    </div>
                  ) : (
                    <article className="animate-in fade-in duration-500">
                      <div 
                        className="prose prose-slate prose-base max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-headings:font-bold"
                        dangerouslySetInnerHTML={renderMarkdown(currentDoc.content)}
                      />
                      
                      {currentDoc.diagramCode && (
                        <div className="mt-16 pt-10 border-t border-slate-100">
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mb-6 text-center">Structural Workflow</h3>
                          <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                            <MermaidDiagram chart={currentDoc.diagramCode} />
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold text-center mt-4">Document Hash: {currentDoc.id}</p>
                        </div>
                      )}
                    </article>
                  )}
                </div>

                <footer className="mt-32 pt-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center md:items-end gap-10">
                   <div className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed text-center md:text-left">
                     <p className="font-bold text-slate-500 mb-1">DocuCraft Pro Systems</p>
                     <p>© 2024 Infrastrux Solutions. Confidential Property.</p>
                   </div>
                   <div className="text-center md:text-right">
                     <div className="h-16 w-56 border-b border-slate-300 mb-2 bg-slate-50/50"></div>
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{currentDoc.author}</p>
                     <p className="text-[10px] text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                   </div>
                </footer>
              </div>
            </div>
          )}
        </div>

        {(isLoading || isRefining) && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
            <div className="bg-slate-900 p-12 rounded-[40px] shadow-2xl max-w-md w-full text-center space-y-10 border border-slate-800 animate-in zoom-in">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-[6px] border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-[6px] border-t-blue-500 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                  <Sparkles className="w-10 h-10 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  {isLoading ? (inputs.attachment ? 'Analyzing Technical Assets' : 'Synthesizing Architecture') : 'Refining Technical Logic'}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed px-4">
                  AI is crafting high-fidelity engineering documentation {inputs.attachment ? 'incorporating your uploaded reference materials' : 'based on your technical scope'}.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-.3s]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-.5s]"></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
