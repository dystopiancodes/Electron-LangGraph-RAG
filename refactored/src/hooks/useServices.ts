import { useState, useEffect } from "react";
import { ServiceFactory } from "../services/serviceFactory";
import { LLMService, EmbeddingService } from "../services/interfaces";

export const useServices = (llmProvider: string, embeddingProvider: string) => {
  const [llmService, setLLMService] = useState<LLMService | null>(null);
  const [embeddingService, setEmbeddingService] =
    useState<EmbeddingService | null>(null);

  useEffect(() => {
    setLLMService(ServiceFactory.getLLMService(llmProvider as any));
    setEmbeddingService(
      ServiceFactory.getEmbeddingService(embeddingProvider as any)
    );
  }, [llmProvider, embeddingProvider]);

  return { llmService, embeddingService };
};
