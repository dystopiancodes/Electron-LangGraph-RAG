import * as electronLog from "electron-log";
import fetch from "node-fetch";
import { OLLAMA_API_URL } from "../../constants";

/**
 * Lists available Ollama models
 * @returns {Promise<string[]>} List of available model names
 */
export const listOllamaModels = async (): Promise<string[]> => {
  try {
    electronLog.info("Attempting to list Ollama models");
    electronLog.info(`Using Ollama API URL: ${OLLAMA_API_URL}`);

    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Ollama models. Status: ${response.status}, StatusText: ${response.statusText}`
      );
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      throw new Error(
        `Unexpected response format from Ollama API: ${JSON.stringify(data)}`
      );
    }
    electronLog.info("Available Ollama models:", data.models);
    return data.models.map((model: any) => model.name);
  } catch (error) {
    electronLog.error(
      "Error listing Ollama models:",
      (error as Error).message,
      "Stack:",
      (error as Error).stack
    );
    return [];
  }
};
