
import React from 'react';

interface LetterheadProps {
  projectName: string;
  clientName: string;
  author: string;
  date: string;
  docType: string;
}

const Letterhead: React.FC<LetterheadProps> = ({ projectName, clientName, author, date, docType }) => {
  return (
    <header className="mb-12 relative">
      <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
               <img 
                 src="https://notugnacjjfaqatzzzgi.supabase.co/storage/v1/object/public/logo/Generated_Image_October_24__2025_-_10_58AM-removebg-preview.png" 
                 alt="CS Tech Solutions Logo" 
                 className="w-12 h-12 object-contain"
               />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">CS TECH SOLUTIONS</h1>
              <p className="text-[9px] text-blue-600 uppercase font-bold tracking-tight mt-1">Custom Web Development & Managed Hosting South Africa</p>
            </div>
          </div>
          <div className="mt-4">
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Global Operations Hub</p>
             <p className="text-[10px] text-slate-500 font-medium">Cape Town • Johannesburg • Durban</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="inline-block bg-slate-100 px-3 py-1 rounded-md text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
            Proprietary & Confidential
          </div>
          <h2 className="text-4xl font-serif italic text-slate-900 mb-1">{docType}</h2>
          <div className="flex flex-col items-end mt-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Filing Date</p>
            <p className="text-sm font-semibold text-slate-800 border-t border-slate-200 pt-1 px-2">{date}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-10 grid grid-cols-3 gap-8 text-sm">
        <div className="col-span-1">
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-2">Project Identity</p>
          <p className="text-slate-900 font-black text-xl leading-tight">{projectName}</p>
        </div>
        <div className="col-span-1 border-l border-slate-100 pl-8">
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-2">Client Entity</p>
          <p className="text-slate-800 font-bold text-lg">{clientName}</p>
        </div>
        <div className="col-span-1 border-l border-slate-100 pl-8">
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-2">Project Principal</p>
          <p className="text-slate-800 font-bold">{author}</p>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mt-1">Technical Lead Engineer</p>
        </div>
      </div>

      <div className="absolute bottom-[-1.5px] left-0 w-24 h-[3px] bg-blue-600"></div>
    </header>
  );
};

export default Letterhead;
