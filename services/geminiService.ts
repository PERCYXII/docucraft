
import { GoogleGenAI, Type } from "@google/genai";
import { DocType, ProjectInputs } from "../types";

// Initialize the Google GenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDocument = async (inputs: ProjectInputs) => {
  const systemPrompt = `You are a professional technical writer and senior architect. 
  Create a highly detailed, corporate-quality document for: ${inputs.type}.
  Project: ${inputs.projectName} | Client: ${inputs.clientName}.
  
  DOCUMENT STRUCTURE:
  - Professional summary, objectives, detailed technical breakdown, and conclusion.
  - Use high-level engineering terminology.
  
  MULTIMODAL INSTRUCTIONS:
  - If an attachment (image or document) is provided, analyze it thoroughly.
  - Incorporate specific technical details from the attachment into the text and diagrams.

  MERMAID DIAGRAM RULES (CRITICAL):
  1. Use 'graph TD' for all flowcharts.
  2. STRICT SYNTAX: Use only the [ID]["Label"] format for nodes.
     - CORRECT: A["Detailed Step Description"]
     - DO NOT use (), (([])), {{}}, or (()) shapes.
     - DO NOT use subgraphs.
  3. ALL labels must be wrapped in double quotes to handle special characters like &, /, (, ).
  4. Ensure all node IDs are simple alphanumeric characters (e.g., A, B, C1, Step1).
  5. Avoid using reserved Mermaid keywords as node IDs.`;

  const parts: any[] = [
    { text: `Generate a professional ${inputs.type} document. Project Context: ${inputs.description}` }
  ];

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
      systemInstruction: systemPrompt,
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

  return JSON.parse(response.text);
};

export const refineDocument = async (currentContent: string, currentDiagram: string, instruction: string) => {
  const systemPrompt = `Update technical documentation.
  Instruction: "${instruction}".
  
  DIAGRAM REFINEMENT:
  - If fixing a diagram error: Use 'graph TD', simple node IDs, and wrap ALL labels in DOUBLE QUOTES.
  - Remove subgraphs if they cause layout issues.
  - Example: A["User Interface"] --> B["API Service"]`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Current Content: ${currentContent}\n\nCurrent Diagram: ${currentDiagram}\n\nAdjustment: ${instruction}`,
    config: {
      systemInstruction: systemPrompt,
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

  return JSON.parse(response.text);
};
