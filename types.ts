export interface FieldData {
  key: string;
  value: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'checkbox' | 'currency' | 'signature' | 'email' | 'phone' | 'address' | 'image';
  status: 'filled' | 'empty' | 'uncertain' | 'skipped';
  required: boolean;
  example?: string; // e.g. "john@example.com"
  confidence?: number; // 0-1
  explanation?: string; // Why Gemini extracted this
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] normalized coordinates (0-1)
}

export interface DocumentAnalysis {
  documentType: string;
  summary: string;
  fields: FieldData[];
  missingFields: string[]; // List of required fields that are empty
  securityRisks: string[]; // E.g., visible credit card numbers
  actionableInsights: string[]; // "Please sign page 2"
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  REVIEW = 'REVIEW',
  ERROR = 'ERROR'
}

export interface UploadedFile {
  name: string;
  type: string;
  url: string; // Object URL for preview
  base64: string; // For API
}