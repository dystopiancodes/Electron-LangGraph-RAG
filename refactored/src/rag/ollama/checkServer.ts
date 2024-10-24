import * as electronLog from "electron-log";
import fetch from "node-fetch";
import { OLLAMA_API_URL } from "../../constants";
import http from "http";

/**
 * Checks the status of the Ollama server
 * @param {string} model - The model to check
 * @returns {Promise<boolean>} Whether the server is running and accessible
 */
export const checkOllamaServer = async (model: string): Promise<boolean> => {
  try {
    electronLog.info(`Checking Ollama server for model: ${model}`);
    electronLog.info(`Using Ollama API URL: ${OLLAMA_API_URL}`);

    const isReachable = await checkServerReachable();
    if (!isReachable) {
      electronLog.error("Ollama server is not reachable");
      return false;
    }

    // Check if the model exists
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const modelExists = data.models.some((m: any) => m.name === model);

    if (modelExists) {
      electronLog.info(`Model ${model} exists on the Ollama server.`);
      return true;
    } else {
      electronLog.warn(`Model ${model} does not exist on the Ollama server.`);
      return false;
    }
  } catch (error) {
    electronLog.error(
      "Error checking Ollama server:",
      (error as Error).message,
      "Stack:",
      (error as Error).stack
    );
    return false;
  }
};

export const checkServerReachable = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const req = http.get(OLLAMA_API_URL, (res) => {
      electronLog.info(`Server responded with status code: ${res.statusCode}`);
      resolve(true);
    });

    req.on("error", (error) => {
      electronLog.error(`Error reaching server: ${error.message}`);
      resolve(false);
    });

    req.end();
  });
};
