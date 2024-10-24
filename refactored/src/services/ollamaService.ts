import { LLMService, EmbeddingService } from "./interfaces";
import { OLLAMA_API_URL } from "../constants";
import fetch from "node-fetch";

export class OllamaLLMService implements LLMService {
  async generateResponse(prompt: string): Promise<string> {
    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model: "llama3.2:3b-instruct-fp16" }),
    });
    const data = await response.json();
    return data.response;
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    const data = await response.json();
    return data.models.map((model: any) => model.name);
  }

  async checkServerStatus(model: string): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "test", model }),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async testModel(model: string): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "What is the capital of France?",
          model,
        }),
      });
      const data = await response.json();
      return !!data.response;
    } catch (error) {
      return false;
    }
  }
}

export class OllamaEmbeddingService implements EmbeddingService {
  async generateEmbeddings(text: string): Promise<number[]> {
    const response = await fetch(`${OLLAMA_API_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        model: "mxbai-embed-large:latest",
      }),
    });
    const data = await response.json();
    return data.embedding;
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    const data = await response.json();
    return data.models
      .filter((model: any) => model.name.toLowerCase().includes("embed"))
      .map((model: any) => model.name);
  }
}
