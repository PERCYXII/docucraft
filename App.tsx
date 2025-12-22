
import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  Printer, 
  Layout, 
  Briefcase, 
  Settings, 
  Loader2, 
  Trash2, 
  DatabaseZap, 
  AlertCircle, 
  Edit3, 
  Eye, 
  Sparkles, 
  CheckCircle2, 
  Upload, 
  X, 
  FileUp, 
  Info, 
  Cpu, 
  User,
  RefreshCcw,
  History,
  Send,
  Wand2,
  Save
} from 'lucide-react';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { DocType, DocumentData, ProjectInputs } from './types';
import { generateDocument, refineDocument, getNodeAnalysis } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import Letterhead from './components/Letterhead';
import MermaidDiagram from './components/MermaidDiagram';

// Configure marked with syntax highlighting
// Note: We removed the custom renderer overrides for table/code to fix the 'e.replace' TypeError
// which was caused by signature changes in marked v12+. 
// Responsive tables and code block styling are now handled via CSS in index.html.
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  }),
  {
    gfm: true,
    breaks: true
  }
);

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
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [history, setHistory] = useState<DocumentData[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Interaction States
  const [selectedNode, setSelectedNode] = useState<{id: string, label: string} | null>(null);
  const [nodeAnalysis, setNodeAnalysis] = useState<string | null>(null);
  const [isAnalyzingNode, setIsAnalyzingNode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchHistory();
    } else {
      setDbError("Supabase connection keys are missing. Running in local preview mode.");
    }
  }, []);

  const fetchHistory = async () => {
    if (!supabase) return;
    setIsHistoryLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') throw new Error("Database table 'documents' does not exist. Please initialize your schema.");
        throw new Error(error.message || "Failed to query the vault");
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
      console.error("Supabase Fetch Error:", err);
      setDbError(err.message);
    } finally {
      setIsHistoryLoading(false);
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
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB.");
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supabase || id.startsWith('temp')) {
      return;
    }
    
    if (!confirm("Are you sure you want to permanently delete this document from the cloud vault?")) return;
    
    const previousHistory = [...history];
    setHistory(history.filter(doc => doc.id !== id));
    
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      if (currentDoc?.id === id) setCurrentDoc(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setHistory(previousHistory);
      alert("Failed to delete document. Please check your connection.");
    }
  };

  const saveToCloud = async (doc: DocumentData) => {
    if (!supabase) return doc;
    setIsSaving(true);
    try {
      const isExisting = !doc.id.startsWith('temp');
      const payload = {
        type: doc.type,
        project_name: doc.projectName,
        client_name: doc.clientName,
        author: doc.author,
        content: doc.content,
        diagram_code: doc.diagramCode
      };

      let result;
      if (isExisting) {
        result = await supabase.from('documents').update(payload).eq('id', doc.id).select();
      } else {
        result = await supabase.from('documents').insert([payload]).select();
      }

      if (result.error) throw result.error;
      if (result.data && result.data[0]) {
        const saved = {
          ...doc,
          id: result.data[0].id,
          date: new Date(result.data[0].created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        };
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchHistory();
        return saved;
      }
    } catch (error) {
      console.warn("Cloud Sync Error:", error);
      setDbError("Cloud sync failed. Working in local preview.");
    } finally {
      setIsSaving(false);
    }
    return doc;
  };

  const handleManualSave = async () => {
    if (!currentDoc) return;
    const saved = await saveToCloud(currentDoc);
    setCurrentDoc(saved);
  };

  const handleGenerate = async () => {
    if (!inputs.projectName || !inputs.description || !inputs.clientName || !inputs.author) {
      alert("Please fill in all mandatory fields: Project, Client, Author, and Scope.");
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
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        content: result.content,
        diagramCode: result.diagramCode
      };

      const savedDoc = await saveToCloud(newDocData);
      setCurrentDoc(savedDoc);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate document. Please check your inputs and try again.");
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
      const savedDoc = await saveToCloud(updatedDoc);
      setCurrentDoc(savedDoc);
      setRefinePrompt('');
    } catch (err) {
      console.error("Refinement failed:", err);
      alert("AI was unable to process the refinement request.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleNodeClick = async (id: string, label: string) => {
    if (!currentDoc) return;
    setSelectedNode({ id, label });
    setNodeAnalysis(null);
    setIsAnalyzingNode(true);
    try {
      const analysis = await getNodeAnalysis(label, currentDoc.content);
      setNodeAnalysis(analysis || "No analysis available for this component.");
    } catch (err) {
      console.error("Node analysis failed:", err);
      setNodeAnalysis("Failed to retrieve architectural details.");
    } finally {
      setIsAnalyzingNode(false);
    }
  };

  const handlePrint = () => window.print();

  const handleReset = () => {
    setCurrentDoc(null);
    setIsEditing(false);
    setSelectedNode(null);
    setInputs({ type: DocType.PLAYBOOK, projectName: '', clientName: '', author: '', description: '' });
  };

  const renderMarkdown = (content: string) => {
    try {
      // Ensure content is a string to avoid marked crash
      const safeContent = typeof content === 'string' ? content : '';
      return { __html: marked.parse(safeContent) as string };
    } catch (e) {
      console.error("Markdown parse error:", e);
      return { __html: '<p class="text-red-500">Error rendering document content.</p>' };
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-80 bg-slate-900 text-slate-300 p-6 flex-shrink-0 flex flex-col no-print border-r border-slate-800">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Layout className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">DocuCraft <span className="text-blue-500 font-light">Pro</span></h1>
        </div>
        
        <nav className="space-y-1 flex-grow overflow-y-auto custom-scrollbar pr-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Operations</p>
          <button onClick={handleReset} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${!currentDoc ? 'bg-slate-800 text-white shadow-lg' : 'hover:bg-slate-800/50 hover:text-white'}`}>
            <PlusCircle className="w-4 h-4" />
            <span className="font-semibold text-sm">Create New Document</span>
          </button>
          
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <History className="w-3 h-3" /> Archived Vault
              </p>
              {isHistoryLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
            </div>

            {dbError ? (
              <div className="px-4 py-5 bg-amber-900/10 rounded-2xl border border-amber-900/20 text-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-[10px] text-amber-200/80 leading-tight mb-3">{dbError}</p>
                <button onClick={fetchHistory} className="text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-all inline-flex items-center gap-2">
                  <RefreshCcw className="w-2.5 h-2.5" /> Reconnect
                </button>
              </div>
            ) : isHistoryLoading && !history.length ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-slate-800/50 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="px-4 py-10 text-center bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                <p className="text-xs text-slate-600 font-medium">Vault is currently empty</p>
              </div>
            ) : (
              <div className="space-y-1">
                {history.map(doc => (
                  <button 
                    key={doc.id} 
                    onClick={() => { setCurrentDoc(doc); setIsEditing(false); setSelectedNode(null); }} 
                    className={`group w-full text-left flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm ${currentDoc?.id === doc.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    <div className="truncate flex-1">
                      <p className="font-bold truncate text-xs">{doc.projectName}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${currentDoc?.id === doc.id ? 'text-blue-100/70' : 'text-slate-600'}`}>{doc.type}</p>
                    </div>
                    <Trash2 
                      onClick={(e) => handleDelete(doc.id, e)}
                      className={`w-3.5 h-3.5 ml-2 opacity-0 group-hover:opacity-100 transition-all hover:text-red-400`} 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
        
        <div className="mt-auto pt-6 border-t border-slate-800 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSupabaseConfigured ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
            <DatabaseZap className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className="text-[10px]">
            <p className="text-slate-400 font-black uppercase tracking-tighter">{isSupabaseConfigured ? 'Live Cloud Sync' : 'Offline Preview'}</p>
            <p className="text-slate-600 font-medium">{isSupabaseConfigured ? 'Enterprise Mode' : 'Connect Supabase'}</p>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10 relative bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {!currentDoc ? (
            <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 md:p-12 transition-all no-print animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-12">
                <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4 inline-block">Drafting Terminal</span>
                <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Professional Documentation</h2>
                <p className="text-slate-500 text-lg leading-relaxed font-medium">Synthesize high-fidelity technical playbooks and corporate scope documents.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings className="w-3 h-3 text-blue-600" /> Template Structure</label>
                  <select 
                    value={inputs.type} 
                    onChange={e => setInputs({...inputs, type: e.target.value as DocType})} 
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 outline-none bg-slate-50 hover:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold appearance-none cursor-pointer text-slate-700"
                  >
                    {Object.values(DocType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Briefcase className="w-3 h-3 text-blue-600" /> Project Title</label>
                  <input 
                    type="text" 
                    value={inputs.projectName} 
                    onChange={e => setInputs({...inputs, projectName: e.target.value})} 
                    placeholder="e.g. Infrastructure Modernization" 
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 outline-none bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3 text-blue-600" /> Client Name</label>
                  <input 
                    type="text" 
                    value={inputs.clientName} 
                    onChange={e => setInputs({...inputs, clientName: e.target.value})} 
                    placeholder="e.g. Acme Corp Inc." 
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 outline-none bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User className="w-3 h-3 text-blue-600" /> Lead Author</label>
                  <input 
                    type="text" 
                    value={inputs.author} 
                    onChange={e => setInputs({...inputs, author: e.target.value})} 
                    placeholder="Document prepared by..." 
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 outline-none bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileUp className="w-3 h-3 text-blue-600" /> Technical Data (Opt)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileChange}
                    className={`h-[58px] border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer transition-all ${isDragging ? 'bg-blue-50 border-blue-400 scale-102' : inputs.attachment ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
                    {inputs.attachment ? (
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{inputs.attachment.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeAttachment(); }} className="hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
                        <Upload className="w-4 h-4" /> Import Specs
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope & Functional Requirements</label>
                  <textarea 
                    rows={5} 
                    value={inputs.description} 
                    onChange={e => setInputs({...inputs, description: e.target.value})} 
                    placeholder="Detail the technical landscape, key deliverables, and constraints..." 
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 outline-none bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all resize-none font-semibold text-slate-700"
                  ></textarea>
                </div>
              </div>

              <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Info className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 max-w-sm leading-relaxed uppercase tracking-wider">
                    Powered by <span className="text-blue-600">Gemini 3 Pro</span>. Generates PDF-ready markup and interactive Mermaid system diagrams.
                  </p>
                </div>
                <button 
                  onClick={handleGenerate} 
                  disabled={isLoading} 
                  className="w-full md:w-auto bg-slate-900 hover:bg-blue-600 text-white font-black py-5 px-16 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 shadow-2xl shadow-blue-500/20 group uppercase tracking-widest text-sm"
                >
                  {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Synthesizing...</> : <><Sparkles className="w-5 h-5" /> Generate Document</>}
                </button>
              </div>
            </section>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-4 duration-700 pb-32">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print sticky top-4 z-40 bg-slate-50/80 backdrop-blur-xl py-4 px-6 rounded-[2rem] border border-white/40 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3">
                  <button onClick={handleReset} className="bg-white hover:bg-slate-100 text-slate-700 px-5 py-3 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 font-black text-[11px] uppercase tracking-widest"><PlusCircle className="w-4 h-4" /> New Draft</button>
                  <button onClick={() => setIsEditing(!isEditing)} className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 px-5 py-3 rounded-xl border shadow-sm transition-all ${isEditing ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'}`}>
                    {isEditing ? <><Eye className="w-4 h-4" /> View Document</> : <><Edit3 className="w-4 h-4" /> Edit Content</>}
                  </button>
                  {isEditing && (
                    <button onClick={handleManualSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {saveSuccess && <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cloud Synced</span>}
                  <button onClick={handlePrint} className="bg-slate-900 hover:bg-blue-600 text-white px-8 py-3 rounded-xl flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/10"><Printer className="w-4 h-4" /> Export PDF</button>
                </div>
              </div>

              {/* Document Paper Surface */}
              <div className="bg-white p-[1.5cm] md:p-[2.5cm] min-h-[29.7cm] shadow-3xl border border-slate-200 rounded-[2.5rem] letterhead-page mb-8 relative overflow-hidden transition-all">
                <Letterhead 
                  projectName={currentDoc.projectName} 
                  clientName={currentDoc.clientName} 
                  author={currentDoc.author} 
                  date={currentDoc.date} 
                  docType={currentDoc.type} 
                />
                
                <div className="mt-16 text-slate-800 leading-relaxed space-y-8">
                  {isEditing ? (
                    <div className="space-y-6 no-print animate-in fade-in">
                       <div className="flex items-center justify-between gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                         <div className="flex items-center gap-2"><Edit3 className="w-3 h-3" /> Visual Markdown Editor</div>
                         <div className="text-slate-400 font-medium normal-case">Changes are saved to the cloud when you click "Save Changes"</div>
                       </div>
                       <textarea className="w-full min-h-[600px] p-10 font-mono text-sm bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={currentDoc.content} onChange={(e) => setCurrentDoc({...currentDoc, content: e.target.value})} />
                       <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 mt-8"><Cpu className="w-3 h-3" /> Architectural Flow Logic</div>
                       <textarea className="w-full min-h-[180px] p-8 font-mono text-[11px] bg-slate-900 text-emerald-400 border border-slate-800 rounded-3xl outline-none" value={currentDoc.diagramCode || ''} onChange={(e) => setCurrentDoc({...currentDoc, diagramCode: e.target.value})} />
                    </div>
                  ) : (
                    <article className="animate-in fade-in duration-500">
                      <div className="prose prose-slate prose-lg max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-headings:font-black prose-a:text-blue-600" dangerouslySetInnerHTML={renderMarkdown(currentDoc.content)} />
                      {currentDoc.diagramCode && (
                        <div className="mt-20 pt-16 border-t border-slate-100">
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-12 text-center">System Integration Architecture</h3>
                          <MermaidDiagram chart={currentDoc.diagramCode} onNodeClick={handleNodeClick} />
                        </div>
                      )}
                    </article>
                  )}
                </div>

                <footer className="mt-32 pt-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center md:items-end gap-10 opacity-50">
                   <div className="text-[9px] text-slate-400 uppercase tracking-widest leading-relaxed text-center md:text-left font-bold">
                     <p className="text-slate-600 mb-1">DocuCraft Systems Architectural Suite</p>
                     <p>© 2024-2025 Infrastrux Solutions. All Rights Reserved. Classified & Protected.</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-px bg-slate-200"></div>
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Doc-ID: {currentDoc.id.slice(-8).toUpperCase()}</div>
                   </div>
                </footer>
              </div>

              {/* AI Refinement Tool - Floating Bar */}
              {!isEditing && (
                <div className="no-print sticky bottom-8 left-0 right-0 max-w-2xl mx-auto z-50 animate-in slide-in-from-bottom-8 duration-500">
                  <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-3xl shadow-2xl shadow-blue-900/40 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-4 px-4">
                      <Wand2 className={`w-5 h-5 text-blue-400 ${isRefining ? 'animate-pulse' : ''}`} />
                      <input 
                        type="text" 
                        value={refinePrompt}
                        onChange={e => setRefinePrompt(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleRefine()}
                        placeholder="Refine with AI: 'Add risk assessment', 'Technical dive'..."
                        className="bg-transparent border-none outline-none text-white text-sm w-full font-medium placeholder:text-slate-500"
                        disabled={isRefining}
                      />
                    </div>
                    <button 
                      onClick={handleRefine}
                      disabled={isRefining || !refinePrompt.trim()}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl transition-all disabled:bg-slate-800 disabled:text-slate-600"
                    >
                      {isRefining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-center mt-3 text-slate-400 uppercase tracking-widest font-black opacity-50">Intelligent Assistant Connected • Syncing with Cloud Vault</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Interactive Node Deep Dive Panel */}
      {selectedNode && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-4xl z-[100] border-l border-slate-200 animate-in slide-in-from-right duration-300 no-print flex flex-col">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl"><Cpu className="w-6 h-6" /></div>
              <div>
                <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-blue-400 mb-1">Architectural Component</h3>
                <p className="text-sm font-bold truncate max-w-[280px]">{selectedNode.label}</p>
              </div>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/30">
            {isAnalyzingNode ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6">
                <div className="relative">
                   <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                   <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-blue-400 animate-pulse" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Querying Knowledge Graph...</p>
              </div>
            ) : (
              <div className="prose prose-sm prose-slate max-w-none animate-in fade-in duration-500">
                {nodeAnalysis ? (
                  <div dangerouslySetInnerHTML={renderMarkdown(nodeAnalysis)} />
                ) : (
                  <div className="p-12 text-center">
                    <AlertCircle className="w-10 h-10 text-slate-200 mx-auto mb-6" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Analysis Unavailable</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="p-8 bg-white border-t border-slate-100">
            <button onClick={() => setSelectedNode(null)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-2xl shadow-blue-500/20 active:scale-95">Back to Main System</button>
          </div>
        </div>
      )}

      {/* Universal Loading Overlay */}
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-slate-900 p-14 rounded-[3.5rem] shadow-4xl max-w-md w-full text-center space-y-12 border border-slate-800 animate-in zoom-in duration-500">
            <div className="relative w-40 h-40 mx-auto">
              <div className="absolute inset-0 rounded-full border-[10px] border-slate-800/50"></div>
              <div className="absolute inset-0 rounded-full border-[10px] border-t-blue-500 border-r-blue-400/20 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                <Sparkles className="w-16 h-16 animate-pulse" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black text-white tracking-tighter">{isLoading ? 'Synthesizing' : 'Syncing Vault'}</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed px-6">
                {isLoading 
                  ? "Gemini 3 Pro is processing your architectural requirements and generating technical specifications..." 
                  : "Establishing secure connection to Supabase and encrypting document metadata..."}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce delay-0"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce delay-150"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce delay-300"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
