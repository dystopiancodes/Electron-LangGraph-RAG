import { LLMService, EmbeddingService } from "./interfaces";
import { OllamaLLMService, OllamaEmbeddingService } from "./ollamaService";

type ServiceProvider = "ollama" | "claude" | "openai";

export class ServiceFactory {
  static getLLMService(provider: ServiceProvider): LLMService {
    switch (provider) {
      case "ollama":
        return new OllamaLLMService();
      // Add cases for other providers here
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  static getEmbeddingService(provider: ServiceProvider): EmbeddingService {
    switch (provider) {
      case "ollama":
        return new OllamaEmbeddingService();
      // Add cases for other providers here
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }
}
