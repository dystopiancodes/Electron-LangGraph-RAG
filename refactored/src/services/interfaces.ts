export interface LLMService {
  generateResponse(prompt: string): Promise<string>;
  listModels(): Promise<string[]>;
  checkServerStatus(model: string): Promise<boolean>;
  testModel(model: string): Promise<boolean>;
}

export interface EmbeddingService {
  generateEmbeddings(text: string | string[]): Promise<number[] | number[][]>;
  listModels(): Promise<string[]>;
}
