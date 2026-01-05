
import { GoogleGenAI, Type } from "@google/genai";
import { DocType, ProjectInputs } from "../types";

// Always use the API_KEY directly from process.env as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BASE_SYSTEM_INSTRUCTION = `You are a world-class Technical Consultant and Senior Systems Architect from a top-tier firm like McKinsey or Accenture.
Your goal is to create high-fidelity, corporate-grade technical documents that are actionable, authoritative, and visually structured.

DOCUMENT TYPES & FOCUS:
- PROJECT PLAYBOOK: Comprehensive execution guides with step-by-step workflows, specific tool recommendations, and "Red Flag" warnings.
- SCOPE OF WORK (SOW): Rigid definitions of boundaries, deliverables, constraints, and success criteria.
- BUILD GUIDE: Deep technical implementation steps, code snippets (if relevant), and configuration checklists.
- PROJECT INSTRUCTIONS: Operational procedures for teams to follow specific tasks.

TONE & STYLE:
- Use professional, punchy, and authoritative language.
- Use "Pro-Tips" and "Actionable Insights" callouts using markdown blockquotes.
- Organize content with hierarchical headings (H1, H2, H3).
- Use tables for comparison, checklists, and revision history.

REVISION HISTORY REQUIREMENT:
- Every document MUST start with a "DOCUMENT REVISION HISTORY" section.
- Column headers: Version, Date, Author, Description.
- Entry 1.0: "Initial Document Generation".

MERMAID DIAGRAM RULES:
1. Use 'graph TD' for architectural flows.
2. Use ID["Label"] format. 
3. Keep logic clean and avoid circular dependencies unless required.
4. All labels MUST be in double quotes.

TOOL INTEGRATION:
- When writing playbooks, explicitly recommend industry-standard tools (e.g., GTmetrix, Wappalyzer, Postman, Snyk, etc.) and explain WHY they are used.`;

export const generateDocument = async (inputs: ProjectInputs) => {
  const prompt = `Generate a high-end professional ${inputs.type} document for the following project:
  
  PROJECT NAME: ${inputs.projectName}
  CLIENT: ${inputs.clientName}
  AUTHOR/LEAD: ${inputs.author}
  
  CONTEXT & REQUIREMENTS:
  ${inputs.description}
  
  INSTRUCTIONS:
  - Create a multi-phase technical guide.
  - Include a section on "Recommended Toolstack".
  - Include "Step-by-Step" execution workflows.
  - Include a "Security & Risk Assessment" section.
  - Include a "Preliminary Assessment" table.
  - Provide a Mermaid.js diagram visualizing the core workflow or system architecture.`;

  const parts: any[] = [{ text: prompt }];

  if (inputs.attachment) {
    parts.push({
      inlineData: {
        data: inputs.attachment.data,
        mimeType: inputs.attachment.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "The full markdown content including headers and tables." },
          diagramCode: { type: Type.STRING, description: "The Mermaid.js flowchart code." }
        },
        required: ["content", "diagramCode"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const refineDocument = async (currentContent: string, currentDiagram: string, instruction: string) => {
  const refinePrompt = `ACT AS A SENIOR EDITOR. Update the following document.
  
  INSTRUCTION: "${instruction}"
  
  CURRENT CONTENT:
  ${currentContent}
  
  CURRENT DIAGRAM:
  ${currentDiagram}
  
  TASK:
  - Integrate the new instructions seamlessly.
  - Update the version history to the next logical step (e.g., 1.1).
  - Ensure the Mermaid diagram is updated if the logic changed.
  - Maintain the professional high-end aesthetic.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: refinePrompt,
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          diagramCode: { type: Type.STRING }
        },
        required: ["content", "diagramCode"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const getNodeAnalysis = async (nodeLabel: string, docContext: string) => {
  const systemPrompt = `You are a Technical Subject Matter Expert. Provide a 4-point technical deep-dive for a specific architectural node.
  
  FORMAT:
  1. **Operational Purpose**: What does this do?
  2. **Technical Implementation**: Best practice tools and technologies for this.
  3. **Risk Profile**: Potential points of failure.
  4. **Verification**: How to test this component.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `COMPONENT: "${nodeLabel}"\n\nCONTEXT: "${docContext}"`,
    config: {
      systemInstruction: systemPrompt,
    }
  });

  return response.text;
};
