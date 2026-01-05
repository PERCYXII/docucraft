
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
  Save,
  BookOpen,
  ArrowRight
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
  const [selectedNode, setSelectedNode] = useState<{ id: string, label: string } | null>(null);
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
        if (error.code === '42P01') throw new Error("Database table 'documents' does not exist.");
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
      setHistory(history.filter(doc => doc.id !== id));
      if (currentDoc?.id === id) setCurrentDoc(null);
      return;
    }

    if (!confirm("Are you sure you want to permanently delete this document?")) return;

    const previousHistory = [...history];
    setHistory(history.filter(doc => doc.id !== id));

    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      if (currentDoc?.id === id) setCurrentDoc(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setHistory(previousHistory);
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
      alert("All fields are mandatory for synthesizing professional documentation.");
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
      alert("Synthesis failed. Check connectivity and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadExample = () => {
    setInputs({
      type: DocType.PLAYBOOK,
      projectName: 'Full Website Audit & Optimization',
      clientName: 'Global Retail Solutions',
      author: 'Senior Systems Consultant',
      description: `Create a full step by step with tool playbook for auditing website follow best practice.
Include External Analysis (no login) and Internal Analysis (admin access required).
Step 0: Prerequisites/Keys (Logins, Analytics, Hosting).
Step 1: Platform/Stack identification (Wappalyzer, BuiltWith).
Step 2: Performance Bottlenecks (GTmetrix Waterfall, Core Web Vitals).
Step 3: Security Scan (WPScan, Mozilla Observatory, SSL Labs).
Step 4: User Traffic Estimation (GA4, Server Logs).
Ensure "Red Flags" and "Pro-Tips" are included for each step.`
    });
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
      setNodeAnalysis(analysis || "Analysis unavailable.");
    } catch (err) {
      setNodeAnalysis("Error retrieving architectural insights.");
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
      const safeContent = typeof content === 'string' ? content : '';
      return { __html: marked.parse(safeContent) as string };
    } catch (e) {
      return { __html: '<p class="text-red-500">Render error.</p>' };
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-80 bg-slate-950 text-slate-300 p-8 flex-shrink-0 flex flex-col no-print border-r border-slate-900">
        <div className="flex items-center gap-4 mb-12">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-2xl shadow-blue-500/40">
            <Layout className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter">DocuCraft</h1>
            <p className="text-[9px] text-blue-500 font-bold uppercase tracking-[0.3em]">Architectural Suite</p>
          </div>
        </div>

        <nav className="space-y-2 flex-grow overflow-y-auto custom-scrollbar pr-2">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Settings className="w-3 h-3" /> System Controls
          </p>
          <button onClick={handleReset} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all ${!currentDoc ? 'bg-white text-slate-950 shadow-xl' : 'hover:bg-slate-900 text-slate-400 hover:text-white'}`}>
            <PlusCircle className="w-4 h-4" />
            <span className="font-bold text-sm">New Document</span>
          </button>

          {!currentDoc && (
            <button onClick={loadExample} className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl hover:bg-blue-600/10 text-slate-400 hover:text-blue-400 border border-transparent hover:border-blue-600/30 transition-all mt-2 group">
              <BookOpen className="w-4 h-4" />
              <span className="font-bold text-sm">Load Website Audit</span>
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
            </button>
          )}

          <div className="mt-14">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2">
                <History className="w-3 h-3" /> Cloud Archive
              </p>
              {isHistoryLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
            </div>

            {dbError ? (
              <div className="px-5 py-6 bg-amber-950/20 rounded-2xl border border-amber-900/30 text-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-3" />
                <p className="text-[10px] text-amber-200/60 leading-tight mb-4">{dbError}</p>
                <button onClick={fetchHistory} className="text-[9px] font-black uppercase tracking-widest bg-slate-900 text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-800 transition-all inline-flex items-center gap-2">
                  <RefreshCcw className="w-3 h-3" /> Reconnect
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="px-6 py-12 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800">
                <p className="text-[11px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">Encryption Active.<br />Vault Empty.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { setCurrentDoc(doc); setIsEditing(false); setSelectedNode(null); }}
                    className={`group w-full text-left flex items-center justify-between px-5 py-4 rounded-2xl transition-all text-sm ${currentDoc?.id === doc.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'hover:bg-slate-900 text-slate-500 hover:text-white'}`}
                  >
                    <div className="truncate flex-1">
                      <p className="font-black truncate text-xs">{doc.projectName}</p>
                      <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${currentDoc?.id === doc.id ? 'text-blue-100/60' : 'text-slate-700'}`}>{doc.type}</p>
                    </div>
                    <Trash2
                      onClick={(e) => handleDelete(doc.id, e)}
                      className={`w-3.5 h-3.5 ml-3 opacity-0 group-hover:opacity-100 transition-all hover:text-red-400`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-auto pt-8 border-t border-slate-900 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSupabaseConfigured ? 'bg-emerald-500/10 shadow-inner' : 'bg-amber-500/10'}`}>
            <DatabaseZap className={`w-5 h-5 ${isSupabaseConfigured ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div>
            <p className="text-white text-[11px] font-black uppercase tracking-tighter leading-none">{isSupabaseConfigured ? 'Vault Sync' : 'Local Host'}</p>
            <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mt-1">{isSupabaseConfigured ? 'Enterprise v1.2' : 'Preview Mode'}</p>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto p-6 md:p-14 bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {!currentDoc ? (
            <section className="bg-white rounded-[3rem] border border-slate-200 shadow-3xl p-10 md:p-16 transition-all no-print animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-14">
                <span className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full mb-6 inline-block shadow-lg shadow-blue-500/20">Synthesis Engine</span>
                <h2 className="text-5xl font-black text-slate-950 mb-4 tracking-tight leading-[1.1]">Architectural Documents.</h2>
                <p className="text-slate-500 text-xl leading-relaxed font-medium max-w-2xl">Generate professional project playbooks, SOWs, and technical guides with intelligent AI synthesis and architectural diagramming.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-blue-600" /> Synthesis Template</label>
                  <div className="relative">
                    <select
                      value={inputs.type}
                      onChange={e => setInputs({ ...inputs, type: e.target.value as DocType })}
                      className="w-full px-8 py-5 rounded-2xl border-2 border-slate-100 outline-none bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-600/20 focus:ring-8 focus:ring-blue-500/5 transition-all font-bold appearance-none cursor-pointer text-slate-800"
                    >
                      {Object.values(DocType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Layout className="w-4 h-4" /></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-blue-600" /> Project Identifier</label>
                  <input
                    type="text"
                    value={inputs.projectName}
                    onChange={e => setInputs({ ...inputs, projectName: e.target.value })}
                    placeholder="e.g. Nexus API Modernization"
                    className="w-full px-8 py-5 rounded-2xl border-2 border-slate-100 outline-none bg-slate-50 focus:bg-white focus:border-blue-600/20 focus:ring-8 focus:ring-blue-500/5 transition-all font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-blue-600" /> Client Entity</label>
                  <input
                    type="text"
                    value={inputs.clientName}
                    onChange={e => setInputs({ ...inputs, clientName: e.target.value })}
                    placeholder="e.g. Stark Industries"
                    className="w-full px-8 py-5 rounded-2xl border-2 border-slate-100 outline-none bg-slate-50 focus:bg-white focus:border-blue-600/20 focus:ring-8 focus:ring-blue-500/5 transition-all font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User className="w-3.5 h-3.5 text-blue-600" /> Project Lead</label>
                  <input
                    type="text"
                    value={inputs.author}
                    onChange={e => setInputs({ ...inputs, author: e.target.value })}
                    placeholder="Lead Architect name..."
                    className="w-full px-8 py-5 rounded-2xl border-2 border-slate-100 outline-none bg-slate-50 focus:bg-white focus:border-blue-600/20 focus:ring-8 focus:ring-blue-500/5 transition-all font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileUp className="w-3.5 h-3.5 text-blue-600" /> Attachment Data (Opt)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileChange}
                    className={`h-[68px] border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer transition-all ${isDragging ? 'bg-blue-50 border-blue-500 scale-[1.02]' : inputs.attachment ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
                    {inputs.attachment ? (
                      <div className="flex items-center gap-3 text-emerald-600 font-bold text-sm px-4">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="truncate">{inputs.attachment.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeAttachment(); }} className="hover:bg-red-100 p-1.5 rounded-lg text-red-500 transition-all"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-slate-400 text-sm font-bold">
                        <Upload className="w-5 h-5" /> Import Technical Specs
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architectural Context & Detailed Requirements</label>
                  <textarea
                    rows={6}
                    value={inputs.description}
                    onChange={e => setInputs({ ...inputs, description: e.target.value })}
                    placeholder="Provide deep technical context, workflows, or specific instructions for the synthesis engine..."
                    className="w-full px-8 py-6 rounded-[2rem] border-2 border-slate-100 outline-none bg-slate-50 focus:bg-white focus:border-blue-600/20 focus:ring-8 focus:ring-blue-500/5 transition-all resize-none font-bold text-slate-800 leading-relaxed"
                  ></textarea>
                </div>
              </div>

              <div className="mt-16 flex flex-col lg:flex-row items-center justify-between gap-10 border-t border-slate-100 pt-10">
                <div className="flex items-start gap-6 text-slate-500 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="p-3.5 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20">
                    <Info className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">Expert-Level Reasoning</p>
                    <p className="text-[12px] font-medium leading-relaxed max-w-sm">
                      Utilizing <span className="text-blue-600 font-bold">Gemini 3 Pro</span> high-context reasoning. Generates markdown schemas and interactive system flowcharts.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full lg:w-auto bg-slate-950 hover:bg-blue-600 text-white font-black py-6 px-16 rounded-[2rem] flex items-center justify-center gap-4 transition-all transform active:scale-95 disabled:opacity-50 shadow-3xl shadow-blue-600/10 group uppercase tracking-[0.2em] text-sm"
                >
                  {isLoading ? <><Loader2 className="w-6 h-6 animate-spin" /> Finalizing Synthesis...</> : <><Sparkles className="w-6 h-6" /> Synthesize Document</>}
                </button>
              </div>
            </section>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-6 duration-700 pb-40">
              {/* Document Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-10 no-print sticky top-6 z-40 bg-white/90 backdrop-blur-2xl py-5 px-8 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50">
                <div className="flex items-center gap-4">
                  <button onClick={handleReset} className="bg-slate-50 hover:bg-slate-100 text-slate-950 px-6 py-3.5 rounded-2xl border border-slate-200 transition-all flex items-center gap-3 font-black text-[11px] uppercase tracking-widest"><PlusCircle className="w-4.5 h-4.5" /> Back</button>
                  <div className="h-8 w-px bg-slate-200 mx-1"></div>
                  <button onClick={() => setIsEditing(!isEditing)} className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-3 px-6 py-3.5 rounded-2xl border transition-all ${isEditing ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-500/30' : 'bg-white text-slate-950 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}>
                    {isEditing ? <><Eye className="w-4.5 h-4.5" /> Preview Mode</> : <><Edit3 className="w-4.5 h-4.5" /> Manual Edit</>}
                  </button>
                  {isEditing && (
                    <button onClick={handleManualSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30">
                      {isSaving ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Save className="w-4.5 h-4.5" />}
                      Sync Vault
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {saveSuccess && <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Encrypted & Saved</span>}
                  <button onClick={handlePrint} className="bg-slate-950 hover:bg-blue-600 text-white px-10 py-3.5 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-600/10"><Printer className="w-4.5 h-4.5" /> Export PDF</button>
                </div>
              </div>

              {/* Document Paper Surface */}
              <div className="bg-white p-[1.5cm] md:p-[2.5cm] min-h-[29.7cm] shadow-4xl border border-slate-200 rounded-[3rem] letterhead-page mb-10 relative overflow-hidden transition-all ring-1 ring-slate-100">
                <Letterhead
                  projectName={currentDoc.projectName}
                  clientName={currentDoc.clientName}
                  author={currentDoc.author}
                  date={currentDoc.date}
                  docType={currentDoc.type}
                />

                <div className="mt-20 text-slate-800 leading-relaxed space-y-10">
                  {isEditing ? (
                    <div className="space-y-8 no-print animate-in fade-in">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4">
                        <div className="flex items-center gap-3"><Edit3 className="w-4 h-4" /> Markdown Core Editor</div>
                        <div className="text-slate-400 font-bold normal-case bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100">Version 1.2 • Draft Active</div>
                      </div>
                      <textarea className="w-full min-h-[700px] p-12 font-mono text-sm bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none focus:ring-12 focus:ring-blue-500/5 transition-all leading-relaxed shadow-inner" value={currentDoc.content} onChange={(e) => setCurrentDoc({ ...currentDoc, content: e.target.value })} />

                      <div className="flex items-center gap-3 text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-4 mt-12"><Cpu className="w-4 h-4" /> Architectural Logic Engine (Mermaid)</div>
                      <textarea className="w-full min-h-[220px] p-10 font-mono text-[12px] bg-slate-950 text-emerald-400 border-2 border-slate-900 rounded-[2.5rem] outline-none shadow-2xl" value={currentDoc.diagramCode || ''} onChange={(e) => setCurrentDoc({ ...currentDoc, diagramCode: e.target.value })} />
                    </div>
                  ) : (
                    <article className="animate-in fade-in duration-700">
                      <div className="prose prose-slate prose-sm max-w-none prose-headings:font-serif prose-headings:text-slate-950 prose-headings:font-black prose-a:text-blue-600 prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:bg-blue-50/50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-xl" dangerouslySetInnerHTML={renderMarkdown(currentDoc.content)} />
                      {currentDoc.diagramCode && (
                        <div className="mt-24 pt-20 border-t-2 border-slate-100">
                          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.6em] mb-14 text-center">Integration Flow & System Architecture</h3>
                          <MermaidDiagram chart={currentDoc.diagramCode} onNodeClick={handleNodeClick} />
                        </div>
                      )}
                    </article>
                  )}
                </div>

                <footer className="mt-40 pt-14 border-t-2 border-slate-50 flex flex-col md:flex-row justify-between items-center md:items-end gap-12 opacity-40">
                  <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] leading-relaxed text-center md:text-left font-bold">
                    <p className="text-slate-950 mb-1.5 font-black">CS TECH SOLUTIONS</p>
                    <p>© 2024-2025 All Rights Reserved. Document Security Level: Class 4.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-[2px] bg-slate-200"></div>
                    <div className="text-[10px] text-slate-950 font-black uppercase tracking-[0.3em] bg-slate-50 px-5 py-2.5 rounded-xl border-2 border-slate-100 shadow-sm">UID: {currentDoc.id.slice(-10).toUpperCase()}</div>
                  </div>
                </footer>
              </div>

              {/* AI Refinement Tool - Floating Bar */}
              {!isEditing && (
                <div className="no-print sticky bottom-10 left-0 right-0 max-w-2xl mx-auto z-50 animate-in slide-in-from-bottom-12 duration-500">
                  <div className="bg-slate-950/95 backdrop-blur-3xl border border-white/10 p-2.5 rounded-[2.5rem] shadow-4xl shadow-blue-900/50 flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-5 px-6">
                      <Wand2 className={`w-6 h-6 text-blue-400 ${isRefining ? 'animate-pulse' : ''}`} />
                      <input
                        type="text"
                        value={refinePrompt}
                        onChange={e => setRefinePrompt(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleRefine()}
                        placeholder="Neural refinement: 'Deep-dive security', 'Add tool guide'..."
                        className="bg-transparent border-none outline-none text-white text-base w-full font-bold placeholder:text-slate-600"
                        disabled={isRefining}
                      />
                    </div>
                    <button
                      onClick={handleRefine}
                      disabled={isRefining || !refinePrompt.trim()}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-[2rem] transition-all disabled:bg-slate-900 disabled:text-slate-700 shadow-xl shadow-blue-600/20"
                    >
                      {isRefining ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-center mt-5 text-slate-500 uppercase tracking-[0.3em] font-black opacity-60">Architectural LLM Active • Processing Version 1.2 Protocol</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Interactive Node Deep Dive Panel */}
      {selectedNode && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[540px] bg-white shadow-5xl z-[100] border-l-4 border-slate-100 animate-in slide-in-from-right duration-400 no-print flex flex-col">
          <div className="p-10 border-b-2 border-slate-50 flex items-center justify-between bg-slate-950 text-white">
            <div className="flex items-center gap-6">
              <div className="bg-blue-600 p-4 rounded-2xl shadow-2xl shadow-blue-600/30"><Cpu className="w-7 h-7" /></div>
              <div>
                <h3 className="font-black text-[11px] uppercase tracking-[0.4em] text-blue-400 mb-1.5">Architectural Node Analysis</h3>
                <p className="text-lg font-black truncate max-w-[320px]">{selectedNode.label}</p>
              </div>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-3 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"><X className="w-8 h-8" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-50/20 leading-relaxed">
            {isAnalyzingNode ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-10">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
                  <Sparkles className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">Querying Knowledge Base</p>
                  <p className="text-xs font-bold text-slate-400">Synthesizing technical deep-dive...</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-slate prose-lg max-w-none animate-in fade-in duration-600">
                {nodeAnalysis ? (
                  <div dangerouslySetInnerHTML={renderMarkdown(nodeAnalysis)} />
                ) : (
                  <div className="p-16 text-center">
                    <AlertCircle className="w-14 h-14 text-slate-200 mx-auto mb-8" />
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Metadata Unavailable</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-10 bg-white border-t-2 border-slate-50">
            <button onClick={() => setSelectedNode(null)} className="w-full bg-slate-950 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-3xl shadow-blue-600/10 active:scale-[0.98]">Dismiss Analysis</button>
          </div>
        </div>
      )}

      {/* Universal Loading Overlay */}
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[100] flex items-center justify-center p-8 no-print">
          <div className="bg-slate-900 p-20 rounded-[4rem] shadow-5xl max-w-xl w-full text-center space-y-14 border border-slate-800/50 animate-in zoom-in duration-600 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

            <div className="relative w-48 h-48 mx-auto">
              <div className="absolute inset-0 rounded-full border-[14px] border-slate-800/30"></div>
              <div className="absolute inset-0 rounded-full border-[14px] border-t-blue-600 border-r-blue-400/10 animate-spin shadow-[0_0_50px_rgba(37,99,235,0.2)]"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                <Sparkles className="w-20 h-20 animate-pulse" />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-5xl font-black text-white tracking-tighter uppercase">{isLoading ? 'Synthesizing' : 'Syncing'}</h3>
              <p className="text-slate-400 text-lg font-medium leading-relaxed px-10">
                {isLoading
                  ? "Gemini 3 Pro is architecting your technical documentation using high-fidelity reasoning patterns..."
                  : "Securing document metadata and synchronizing with the Enterprise Cloud Vault..."}
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <div className="w-3 h-3 rounded-full bg-blue-700 animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-3 h-3 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
