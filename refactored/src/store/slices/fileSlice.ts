import { StateCreator } from "zustand";
import { OllamaEmbeddingService } from "../../services/ollamaService";

interface FileWithEmbedding {
  file: File;
  embedding?: number[];
}

export interface FileSlice {
  files: FileWithEmbedding[];
  addFile: (file: File) => Promise<void>;
  removeFile: (index: number) => void;
  getEmbedding: (text: string) => Promise<number[]>;
}

// Create the file management slice of the store
export const createFileSlice: StateCreator<FileSlice> = (set, get) => ({
  files: [],
  // Add a new file to the list
  addFile: async (file: File) => {
    const embeddingService = new OllamaEmbeddingService();
    const fileContent = await file.text();
    const embedding = await embeddingService.generateEmbeddings(fileContent);
    set((state) => ({
      files: [...state.files, { file, embedding }],
    }));
  },
  // Remove a file from the list by its index
  removeFile: (index: number) =>
    set((state) => ({
      files: state.files.filter((_, i) => i !== index),
    })),
  // Get the embedding for a given text
  getEmbedding: async (text: string) => {
    const embeddingService = new OllamaEmbeddingService();
    return await embeddingService.generateEmbeddings(text);
  },
});
