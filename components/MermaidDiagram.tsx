
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Aggressively cleans Mermaid syntax to ensure validity.
   * Removes subgraphs and enforces simple node format.
   */
  const sanitizeMermaid = (input: string) => {
    if (!input) return '';
    
    // Remove code blocks
    let s = input.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    
    // Remove all subgraph-related keywords and "end" keywords
    s = s.replace(/subgraph\s+[^\n]*/gi, '');
    s = s.replace(/^\s*end\s*$/gim, '');
    s = s.replace(/endsubgraph/gi, '');
    
    // Fix malformed arrows: -->--> becomes -->, ----> becomes -->, etc.
    s = s.replace(/(-+>)+/g, '-->');
    s = s.replace(/(=+>)+/g, '==>');
    s = s.replace(/(-+\.+-+>)+/g, '-.->');
    
    const lines = s.split('\n').map(l => l.trim()).filter(l => l);
    const processedLines: string[] = [];

    // Ensure valid header
    let hasHeader = false;
    if (lines[0]?.toLowerCase().match(/^(graph|flowchart)\s+/)) {
      processedLines.push(lines[0]);
      hasHeader = true;
    } else {
      processedLines.push('graph TD');
    }

    // Process each line
    for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Skip any remaining subgraph/end keywords
      if (/^(subgraph|end|endsubgraph)/i.test(line)) continue;
      
      // Fix spacing issues around arrows
      line = line.replace(/\s*-->\s*/g, ' --> ');
      line = line.replace(/\s*===>\s*/g, ' ==> ');
      line = line.replace(/\s*-\.->\s*/g, ' -.-> ');
      line = line.replace(/\s*---\s*/g, ' --- ');
      
      // Split by arrows: -->, ==>, -.-, ---
      const parts = line.split(/\s+(-->|==>|-\.->|---)\s+/g);
      
      const sanitizedParts = parts.map(part => {
        const trimmed = part.trim();
        
        // If it's an arrow, keep it
        if (/^(-->|==>|-\.->|---)$/.test(trimmed)) return trimmed;
        
        // Parse node: ID[Label] or ID(Label) or ID{Label}
        const nodeMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*[\[\(\{](.+?)[\]\)\}]\s*$/);
        
        if (nodeMatch) {
          const id = nodeMatch[1];
          // Clean label: remove quotes, brackets, special chars
          const label = nodeMatch[2]
            .replace(/["'`]/g, '')
            .replace(/[\[\]\(\)\{\}]/g, '')
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .trim();
          return `${id}["${label}"]`;
        }
        
        // If just an ID, return it
        if (/^[a-zA-Z0-9_]+$/.test(trimmed)) return trimmed;
        
        return '';
      }).filter(p => p);

      if (sanitizedParts.length > 0) {
        processedLines.push(sanitizedParts.join(' '));
      }
    }

    return processedLines.join('\n');
  };

  useEffect(() => {
    if (containerRef.current && chart) {
      setError(null);
      try {
        const cleanChart = sanitizeMermaid(chart);
        if (!cleanChart) return;

        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'neutral',
          securityLevel: 'loose',
          fontFamily: 'Inter',
          maxTextSize: 90000,
          flowchart: { 
            useMaxWidth: true, 
            htmlLabels: false,
            curve: 'basis' 
          }
        });
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        containerRef.current.innerHTML = '';
        
        mermaid.render(id, cleanChart).then((result) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = result.svg;
          }
        }).catch((err) => {
          console.error("Mermaid Render Error:", err);
          setError("The synthesized schematic contains non-standard node relationships. Please use the Refinement tool to 'simplify the topology'.");
        });
      } catch (e) {
        console.error("Mermaid Setup Error:", e);
        setError("The visualization component failed to initialize the logic schematic.");
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
            <p className="font-black uppercase tracking-widest mb-1 text-red-700">Schematic Parse Fault</p>
            <p className="opacity-80 leading-relaxed text-red-600 font-medium">{error}</p>
          </div>
          <div className="w-full mt-4">
             <p className="text-[10px] text-slate-400 font-bold uppercase mb-2 text-left">Sanitized Debug Schematic:</p>
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
