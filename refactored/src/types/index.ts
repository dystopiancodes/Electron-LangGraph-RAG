export interface ProgressCallback {
  status: string;
  message: string;
  percentage: number;
}

export interface VectorStoreResult {
  success: boolean;
  message: string;
}

export interface RAGResult {
  generation?: string;
  sources?: Array<{
    fileName: string;
    filePath: string;
  }>;
  error?: string;
}
