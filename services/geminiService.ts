
import { GoogleGenAI, Type } from "@google/genai";
import { DocType, ProjectInputs } from "../types";

// Always use the API_KEY directly from process.env as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BASE_SYSTEM_INSTRUCTION = `You are a professional technical writer and senior systems architect. 
Create highly detailed, corporate-quality architectural documents.

DOCUMENT STANDARDS:
- Use industry-standard engineering terminology (e.g., latency, throughput, scalability, abstraction).
- Use professional Markdown styling with clear headings, tables, and lists.
- For "Project Playbooks", focus on execution strategy and milestones.
- For "Scope of Work", focus on boundaries, deliverables, and requirements.
- For "Build Guides", focus on step-by-step technical implementation.

REVISION HISTORY REQUIREMENT:
- Every document MUST start with a "DOCUMENT REVISION HISTORY" section (before the main introduction).
- This section must be a table with columns: Version, Date, Author, and Description.
- Include an initial entry: Version 1.0, current date, author name, and "Initial Document Generation".

MERMAID DIAGRAM RULES (STRICT):
1. Use 'graph TD' for all flowcharts.
2. Syntax: Use ID["Label"] format for nodes.
3. Labels: ALWAYS wrap labels in double quotes. 
   - Good: A["User Interface"] --> B["API Service"]
   - Bad: A[User Interface]
4. Do NOT use complex shapes (subgraphs, parentheses, etc.) unless specifically needed for clarity, and keep them simple.
5. All labels should be concise but descriptive.`;

export const generateDocument = async (inputs: ProjectInputs) => {
  const prompt = `Generate a professional ${inputs.type} document.
  Project: ${inputs.projectName}
  Client: ${inputs.clientName}
  Lead: ${inputs.author}
  Context/Scope: ${inputs.description}
  
  Please provide:
  1. A comprehensive markdown document starting with a revision history table.
  2. A matching system architecture diagram in Mermaid.js syntax.`;

  // Define parts for potential multimodal support
  const parts: any[] = [{ text: prompt }];

  if (inputs.attachment) {
    parts.push({
      inlineData: {
        data: inputs.attachment.data,
        mimeType: inputs.attachment.mimeType
      }
    });
  }

  // Use ai.models.generateContent with model name and contents (Content object)
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "The full markdown content." },
          diagramCode: { type: Type.STRING, description: "The Mermaid.js diagram code." }
        },
        required: ["content", "diagramCode"]
      }
    }
  });

  // response.text is a property, not a method
  return JSON.parse(response.text || "{}");
};

export const refineDocument = async (currentContent: string, currentDiagram: string, instruction: string) => {
  const refinePrompt = `Update the existing document based on the following instruction: "${instruction}"
  
  CURRENT CONTENT:
  ${currentContent}
  
  CURRENT DIAGRAM:
  ${currentDiagram}
  
  Your task:
  - Modify the content to satisfy the instruction while maintaining professional tone.
  - Update the diagram if the change affects architecture.
  - If appropriate, add a new row to the DOCUMENT REVISION HISTORY table (e.g. Version 1.1) summarizing these changes.
  - Return the full updated content and diagram.`;

  // Fix: contents must be a string or a Content object (with parts array)
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

  // response.text is a property, not a method
  return JSON.parse(response.text || "{}");
};

export const getNodeAnalysis = async (nodeLabel: string, docContext: string) => {
  const systemPrompt = `You are a technical consultant. Provide a detailed analysis for a specific component.
  Component: ${nodeLabel}
  
  Structure your response:
  1. Overview & Purpose
  2. Technical Specifications
  3. Integration Requirements
  4. Security Considerations`;

  // Use ai.models.generateContent with model name and contents string
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Based on this document context: "${docContext}", provide a deep-dive analysis for the architecture node: "${nodeLabel}".`,
    config: {
      systemInstruction: systemPrompt,
    }
  });

  // response.text is a property, not a method
  return response.text;
};
