
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

interface MermaidDiagramProps {
  chart: string;
  onNodeClick?: (nodeId: string, nodeLabel: string) => void;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, onNodeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const sanitizeMermaid = (input: string) => {
    let sanitized = input.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    sanitized = sanitized.replace(/(\w+)\(\((.*?)\)\)/g, '$1["$2"]');
    sanitized = sanitized.replace(/(\w+)\(\[(.*?)\]\)/g, '$1["$2"]');
    sanitized = sanitized.replace(/(\w+)\{(.*?)\}/g, '$1["$2"]');
    sanitized = sanitized.replace(/(\w+)\((.*?)\)/g, '$1["$2"]');
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]+)\[([^"\]\s][^\]]*)\]/g, '$1["$2"]');
    sanitized = sanitized.replace(/\["\"(.*?)\"\"\]/g, '["$1"]');
    sanitized = sanitized.replace(/\["(.*?)"\]/g, (match, p1) => `["${p1.replace(/"/g, "'")}"]`);
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
            
            // Add click listeners to all nodes
            const nodes = containerRef.current.querySelectorAll('.node');
            nodes.forEach(node => {
              (node as HTMLElement).style.cursor = 'pointer';
              (node as HTMLElement).style.transition = 'all 0.2s ease';
              
              node.addEventListener('mouseenter', () => {
                const rect = node.querySelector('rect, polygon, circle, path');
                // Fix: Cast to unknown then SVGElement to avoid overlap error with HTMLElement
                if (rect) (rect as unknown as SVGElement).style.filter = 'drop-shadow(0 4px 6px rgba(37, 99, 235, 0.3))';
              });
              
              node.addEventListener('mouseleave', () => {
                const rect = node.querySelector('rect, polygon, circle, path');
                // Fix: Cast to unknown then SVGElement to avoid overlap error with HTMLElement
                if (rect) (rect as unknown as SVGElement).style.filter = 'none';
              });

              node.addEventListener('click', (e) => {
                e.stopPropagation();
                const label = node.querySelector('.label')?.textContent || '';
                const nodeId = node.id;
                if (onNodeClick) onNodeClick(nodeId, label);
              });
            });
          }
        }).catch((err) => {
          console.error("Mermaid Render Error:", err);
          setError("Diagram parsing error.");
        });
      } catch (e) {
        console.error("Mermaid Setup Error:", e);
        setError("Rendering engine error.");
      }
    }
  }, [chart, onNodeClick]);

  if (!chart) return null;

  return (
    <div className="my-8 flex flex-col items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-inner overflow-hidden min-h-[150px] justify-center no-print">
      <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-blue-600/50 uppercase tracking-widest">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        Interactive Diagram: Click any node for a technical deep-dive
      </div>
      {error ? (
        <div className="text-red-500 text-xs bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col items-center gap-3 max-w-lg text-center">
          <p className="font-black uppercase tracking-widest text-red-700">Diagram Parsing Alert</p>
          <pre className="p-3 bg-slate-900 text-slate-400 rounded-xl text-[10px] w-full overflow-x-auto text-left">
            {sanitizeMermaid(chart)}
          </pre>
        </div>
      ) : (
        <div ref={containerRef} className="mermaid w-full flex justify-center scale-90 md:scale-100" />
      )}
    </div>
  );
};

export default MermaidDiagram;
