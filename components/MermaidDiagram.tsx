
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Cleans and fixes Mermaid syntax before rendering.
   * Standardizes nodes to [ID]["Label"] format and removes common AI-generated syntax errors.
   */
  const sanitizeMermaid = (input: string) => {
    let sanitized = input.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    
    // 1. Convert various shapes to standard square brackets to reduce parsing errors
    // Convert (()) to []
    sanitized = sanitized.replace(/(\w+)\(\((.*?)\)\)/g, '$1["$2"]');
    // Convert ([]) to []
    sanitized = sanitized.replace(/(\w+)\(\[(.*?)\]\)/g, '$1["$2"]');
    // Convert {} to []
    sanitized = sanitized.replace(/(\w+)\{(.*?)\}/g, '$1["$2"]');
    // Convert () to []
    sanitized = sanitized.replace(/(\w+)\((.*?)\)/g, '$1["$2"]');
    
    // 2. Fix unquoted labels remaining in brackets
    // Match node IDs followed by brackets where content doesn't start with a quote
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]+)\[([^"\]\s][^\]]*)\]/g, '$1["$2"]');

    // 3. Fix double quotes issue: A[""Label""] -> A["Label"]
    sanitized = sanitized.replace(/\["\"(.*?)\"\"\]/g, '["$1"]');
    sanitized = sanitized.replace(/\["(.*?)"\]/g, (match, p1) => {
      // Remove any internal quotes that might break the outer ones
      return `["${p1.replace(/"/g, "'")}"]`;
    });

    // 4. Clean up any "subgraph" lines that are malformed or missing "end"
    // AI often forgets the space after ID or uses illegal characters in subgraph IDs
    sanitized = sanitized.replace(/subgraph\s+([^\n]+)/g, (match, p1) => {
      const cleanId = p1.trim().replace(/[^a-zA-Z0-9\s]/g, '_');
      return `subgraph "${cleanId}"`;
    });

    return sanitized;
  };

  useEffect(() => {
    if (containerRef.current && chart) {
      setError(null);
      try {
        const cleanChart = sanitizeMermaid(chart);
        
        if (!cleanChart) return;

        // Initialize with robust settings for version 10.9.5
        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'neutral',
          securityLevel: 'loose',
          fontFamily: 'Inter',
          maxTextSize: 90000,
          flowchart: { 
            useMaxWidth: true, 
            htmlLabels: false, // Set to false to prevent some HTML injection parsing errors
            curve: 'basis' 
          }
        });
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Clear previous content
        containerRef.current.innerHTML = '';
        
        mermaid.render(id, cleanChart).then((result) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = result.svg;
          }
        }).catch((err) => {
          console.error("Mermaid Render Error:", err);
          setError("The diagram has syntax errors. Click 'Edit' to fix or 'Apply' a 'simplify diagram' instruction in the Refinement Assistant.");
        });
      } catch (e) {
        console.error("Mermaid Setup Error:", e);
        setError("Rendering engine error.");
      }
    }
  }, [chart]);

  if (!chart) return null;

  return (
    <div className="my-8 flex flex-col items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-inner overflow-hidden min-h-[150px] justify-center no-print">
      {error ? (
        <div className="text-red-500 text-xs bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col items-center gap-3 max-w-lg text-center animate-in fade-in duration-300">
          <div className="bg-red-500 text-white p-2 rounded-lg shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <p className="font-black uppercase tracking-widest mb-1 text-red-700">Diagram Parsing Alert</p>
            <p className="opacity-80 leading-relaxed text-red-600 font-medium">{error}</p>
          </div>
          <div className="w-full mt-4">
             <p className="text-[10px] text-slate-400 font-bold uppercase mb-2 text-left">Internal Logic Representation:</p>
             <pre className="p-3 bg-slate-900 text-slate-400 rounded-xl text-[10px] w-full overflow-x-auto text-left font-mono leading-tight border border-slate-800">
               {sanitizeMermaid(chart)}
             </pre>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="mermaid w-full flex justify-center scale-90 md:scale-100" />
      )}
    </div>
  );
};

export default MermaidDiagram;
