import { StateCreator } from "zustand";
import { LLMService, EmbeddingService } from "../../services/interfaces";
import { ServiceFactory } from "../../services/serviceFactory";

export interface ServiceSlice {
  serverStatus: string;
  ollamaTestResult: string;
  availableModels: string[];
  selectedModel: string;
  llmService: LLMService | null;
  embeddingService: EmbeddingService | null;
  setServerStatus: (status: string) => void;
  setOllamaTestResult: (result: string) => void;
  setAvailableModels: (models: string[]) => void;
  setSelectedModel: (model: string) => void;
  initializeServices: (llmProvider: string, embeddingProvider: string) => void;
}

// Create the service management slice of the store
export const createServiceSlice: StateCreator<ServiceSlice> = (set) => ({
  serverStatus: "",
  ollamaTestResult: "",
  availableModels: [],
  selectedModel: "llama3.2:3b-instruct-fp16",
  llmService: null,
  embeddingService: null,
  // Update the server status
  setServerStatus: (status) => set({ serverStatus: status }),
  // Update the Ollama test result
  setOllamaTestResult: (result) => set({ ollamaTestResult: result }),
  // Set the list of available models
  setAvailableModels: (models) => set({ availableModels: models }),
  // Update the selected model
  setSelectedModel: (model) => set({ selectedModel: model }),
  // Initialize LLM and embedding services
  initializeServices: (llmProvider, embeddingProvider) =>
    set({
      llmService: ServiceFactory.getLLMService(llmProvider as any),
      embeddingService: ServiceFactory.getEmbeddingService(
        embeddingProvider as any
      ),
    }),
});
