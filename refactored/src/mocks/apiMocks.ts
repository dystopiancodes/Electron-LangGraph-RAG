export const mockCheckOllamaServer = async (
  model: string
): Promise<boolean> => {
  console.log(`Mock: Checking Ollama server for model: ${model}`);
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Return a mock response
  return true;
};

export const mockTestOllama = async (model: string): Promise<boolean> => {
  console.log(`Mock: Testing Ollama with model: ${model}`);
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Return a mock response
  return true;
};

export const mockListOllamaModels = async (): Promise<string[]> => {
  console.log("Mock: Listing Ollama models");
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Return a mock list of models
  return ["llama3.2:3b-instruct-fp16", "mxbai-embed-large:latest"];
};
