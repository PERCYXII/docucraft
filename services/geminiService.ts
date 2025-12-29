
import { DocType, ProjectInputs } from "../types";

// Use local API endpoint to avoid CORS issues
const API_URL = '/api/generate';

// Retry helper with exponential backoff for rate limits
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429)
      if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

export const generateDocument = async (inputs: ProjectInputs) => {
  const systemPrompt = `You are a professional technical writer and senior architect at INFRASTRUX. 
  Create a highly detailed, corporate-quality document for: ${inputs.type}.
  Project: ${inputs.projectName} | Client: ${inputs.clientName}.
  
  DOCUMENT STRUCTURE:
  - Professional summary, objectives, detailed technical breakdown, and conclusion.
  - Use high-level engineering terminology.
  
  MULTIMODAL INSTRUCTIONS:
  - If an attachment is provided, analyze it and incorporate specific technical details.

  MERMAID DIAGRAM RULES (CRITICAL - FOLLOW EXACTLY):
  1. Start with ONLY "graph TD" on the first line
  2. NEVER use subgraph - IT IS FORBIDDEN
  3. NEVER use "end" keyword
  4. Node format ONLY: ID["Label Text"]
  5. Connection format ONLY: A --> B (MUST have both source AND target)
  6. Labels can contain: letters, numbers, spaces, hyphens only
  7. NO special characters in labels: no (), {}, [], quotes inside labels
  8. EVERY arrow (-->) MUST connect two valid nodes
  9. NEVER leave arrows incomplete (e.g., "A -->" without a target)
  
  CORRECT EXAMPLE:
  graph TD
  User["User Login"] --> Auth["Verify Credentials"]
  Auth --> Dashboard["Access Dashboard"]
  Dashboard --> Reports["View Reports"]
  
  FORBIDDEN - DO NOT USE:
  - subgraph anything
  - end
  - styling or classes
  - complex shapes like (()) or {{}}
  - incomplete connections (A --> with no target)
  - orphaned arrows (-->  B with no source)
  
  You must respond ONLY with valid JSON in this exact format:
  {
    "content": "the full markdown content",
    "diagramCode": "the mermaid diagram code"
  }`;

  let userPrompt = `Generate a professional ${inputs.type} document. Project Context: ${inputs.description}`;

  if (inputs.attachment) {
    userPrompt += `\n\nNote: An attachment was provided but DeepSeek doesn't support multimodal input yet. Please generate based on the text description.`;
  }

  return retryWithBackoff(async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in API response');
    }

    return JSON.parse(content);
  });
};

export const refineDocument = async (currentContent: string, currentDiagram: string, instruction: string) => {
  const systemPrompt = `Update technical documentation based on instruction.
  Instruction: "${instruction}".
  
  MERMAID REFINEMENT RULES (CRITICAL):
  1. Output ONLY "graph TD" header
  2. NEVER use subgraph or end keywords
  3. Node format: ID["Label Text"]
  4. Connection: A --> B (MUST have both source AND target)
  5. NO special characters in labels except spaces and hyphens
  6. EVERY arrow MUST connect two valid nodes
  7. NEVER leave arrows incomplete
  
  CORRECT EXAMPLE:
  graph TD
  Start["Step One"] --> Process["Step Two"]
  Process --> End["Step Three"]
  
  WRONG - DO NOT DO THIS:
  graph TD
  Start["Step One"] -->
  --> Process["Step Two"]
  
  You must respond ONLY with valid JSON in this exact format:
  {
    "content": "the updated markdown content",
    "diagramCode": "the updated mermaid diagram code"
  }`;

  return retryWithBackoff(async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Current Content: ${currentContent}\n\nCurrent Diagram: ${currentDiagram}\n\nAdjustment: ${instruction}` }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in API response');
    }

    return JSON.parse(content);
  });
};

