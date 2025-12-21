
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
    <header className="mb-12 border-b-2 border-slate-900 pb-8 relative">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <img 
            src="https://notugnacjjfaqatzzzgi.supabase.co/storage/v1/object/public/logo/Generated_Image_October_24__2025_-_10_58AM-removebg-preview.png" 
            alt="Company Logo" 
            className="h-24 w-auto object-contain mb-4"
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">INFRASTRUX SOLUTIONS</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Architectural Engineering & Strategic Builds</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-400 uppercase mb-2 tracking-widest">Official Document</div>
          <h2 className="text-3xl font-serif text-slate-900 mb-1">{docType}</h2>
          <p className="text-sm text-slate-500">{date}</p>
        </div>
      </div>
      
      <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-400 font-medium uppercase text-[10px] tracking-wider mb-1">Project Information</p>
          <p className="text-slate-900 font-semibold text-lg">{projectName}</p>
          <p className="text-slate-600">Client: {clientName}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 font-medium uppercase text-[10px] tracking-wider mb-1">Prepared By</p>
          <p className="text-slate-900 font-semibold">{author}</p>
          <p className="text-slate-600">Senior Project Coordinator</p>
        </div>
      </div>

      <div className="absolute -bottom-[2px] right-0 w-32 h-[2px] bg-blue-600"></div>
    </header>
  );
};

export default Letterhead;
