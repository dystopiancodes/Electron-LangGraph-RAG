import * as electronLog from "electron-log";
import fetch from "node-fetch";
import { OLLAMA_API_URL } from "../../constants";

/**
 * Tests the Ollama server with a simple query
 * @param {string} model - The model to test
 * @returns {Promise<boolean>} Whether the test was successful
 */
export const testOllama = async (model: string): Promise<boolean> => {
  try {
    electronLog.info(`Testing Ollama with model: ${model}`);
    electronLog.info(`Using Ollama API URL: ${OLLAMA_API_URL}`);

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: "What is the capital of France?",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, statusText: ${response.statusText}`
      );
    }

    const data = await response.json();
    electronLog.info("Ollama test result:", data.response);
    return true;
  } catch (error) {
    electronLog.error(
      "Ollama test error:",
      (error as Error).message,
      "Stack:",
      (error as Error).stack
    );
    return false;
  }
};
