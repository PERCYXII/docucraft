
import React from 'react';

interface LetterheadProps {
  projectName: string;
  clientName: string;
  author: string;
  date: string;
  docType: string;
}

const Letterhead: React.FC<LetterheadProps> = ({ projectName, clientName, author, date, docType }) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const logoUrl = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/logo/Generated_Image_October_24__2025_-_10_58AM-removebg-preview.png`
    : '/vite.svg'; // Fallback to default logo

  return (
    <header className="mb-12 border-b-[3px] border-slate-900 pb-10 relative overflow-hidden">
      {/* Subtle Architectural Grid Pattern Overlay */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={logoUrl}
              alt="Company Logo"
              className="h-20 w-auto object-contain"
            />
            <div className="h-12 w-[1px] bg-slate-200 hidden md:block"></div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">INFRASTRUX</h1>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.3em] mt-1">Systems Architecture</p>
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">Global Engineering Headquarters</p>
            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">Technical Division | Series 09-X</p>
          </div>
        </div>

        <div className="text-left md:text-right border-l-2 md:border-l-0 md:border-r-2 border-blue-600 pl-4 md:pl-0 md:pr-4">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-[0.2em]">Official Technical Release</div>
          <h2 className="text-4xl font-serif italic text-slate-900 mb-1 leading-tight">{docType}</h2>
          <div className="flex md:justify-end items-center gap-2">
            <div className="w-8 h-[1px] bg-slate-200"></div>
            <p className="text-xs font-bold text-slate-500 font-mono uppercase">{date}</p>
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50 backdrop-blur-sm">
        <div className="relative">
          <div className="absolute -left-3 top-0 bottom-0 w-[2px] bg-slate-200"></div>
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em] mb-2">Project Specification</p>
          <p className="text-slate-900 font-black text-xl leading-tight mb-1">{projectName || "Untitled Initiative"}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-bold uppercase">Client</span>
            <p className="text-slate-700 font-medium truncate">{clientName || "Proprietary Organization"}</p>
          </div>
        </div>
        <div className="text-left md:text-right relative">
          <div className="absolute -right-3 top-0 bottom-0 w-[2px] bg-slate-200 hidden md:block"></div>
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em] mb-2">Certification Lead</p>
          <p className="text-slate-900 font-black text-xl leading-tight mb-1">{author || "Lead Architect"}</p>
          <p className="text-slate-500 font-medium text-xs">Senior Systems Engineer • Division 04</p>
        </div>
      </div>

      <div className="absolute -bottom-[3px] left-0 w-2/3 h-[3px] bg-blue-600"></div>
      <div className="absolute -bottom-[3px] right-0 w-1/4 h-[3px] bg-slate-900"></div>
    </header>
  );
};

export default Letterhead;
