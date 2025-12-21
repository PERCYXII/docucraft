
export enum DocType {
  PLAYBOOK = 'Project Playbook',
  SOW = 'Scope of Work',
  INSTRUCTIONS = 'Project Instructions',
  BUILD_GUIDE = 'Build Guide'
}

export interface DocumentData {
  id: string;
  type: DocType;
  projectName: string;
  clientName: string;
  author: string;
  date: string;
  content: string;
  diagramCode?: string;
}

export interface Attachment {
  data: string;
  mimeType: string;
  name: string;
}

export interface ProjectInputs {
  type: DocType;
  projectName: string;
  clientName: string;
  author: string;
  description: string;
  attachment?: Attachment;
}
