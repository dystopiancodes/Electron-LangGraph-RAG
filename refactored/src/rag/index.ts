import * as electronLog from "electron-log";
import {
  checkOllamaServer,
  testOllama,
  listOllamaModels,
  checkServerReachable,
} from "./ollama";
import { DEFAULT_LLM_MODEL } from "../constants";
import { RAGResult } from "../types";

// Global variables
let selectedModel = DEFAULT_LLM_MODEL;
let searchUrls: string[] = [];
let sendLogUpdate: (step: string, message: string) => void;

/**
 * Main RAG function to process a question and generate an answer
 * @param {string} question - The input question
 * @param {string} llmModel - The language model to use
 * @param {string} embeddingModel - The embedding model to use
 * @param {function} sendStepUpdate - Function to send step updates
 * @param {function} logUpdateFunction - Function to log updates
 * @param {string} tavilyApiKey - API key for Tavily search
 * @param {boolean} isTavilySearchEnabled - Whether Tavily search is enabled
 * @param {string} selectedFolderPath - Path to the selected folder for document search
 * @returns {Promise<RAGResult>} The generated answer and sources
 */
export const runRAG = async (
  question: string,
  llmModel: string,
  embeddingModel: string,
  sendStepUpdate: (step: string) => void,
  logUpdateFunction: (step: string, message: string) => void,
  tavilyApiKey: string,
  isTavilySearchEnabled: boolean,
  selectedFolderPath: string
): Promise<RAGResult> => {
  try {
    // Set the selected model and log update function
    setSelectedModel(llmModel);
    sendLogUpdate = logUpdateFunction;

    // Log the start of the RAG process
    electronLog.info("Starting RAG pipeline");
    sendLogUpdate("start", "Starting RAG pipeline");

    // Check if the Ollama server is running
    const serverStatus = await checkOllamaServer(llmModel);
    if (!serverStatus) {
      throw new Error("Ollama server is not running or accessible");
    }

    // TODO: Implement actual RAG logic here
    // This should include:
    // 1. Retrieving relevant documents
    // 2. Processing the documents
    // 3. Generating an answer based on the documents and the question

    // For now, return a placeholder result
    return {
      generation: `This is a placeholder answer for the question: "${question}"`,
      sources: [
        { fileName: "placeholder.txt", filePath: "/path/to/placeholder.txt" },
      ],
    };
  } catch (error) {
    electronLog.error("Error in RAG pipeline:", error);
    sendLogUpdate(
      "error",
      `Error in RAG pipeline: ${(error as Error).message}`
    );
    return { error: (error as Error).message || "An unknown error occurred" };
  }
};

/**
 * Sets the search URLs and log update function
 * @param {string[]} urls - The search URLs to set
 * @param {function} logUpdateFunction - The log update function to set
 */
export const setSearchUrls = (
  urls: string[],
  logUpdateFunction: (step: string, message: string) => void
): void => {
  searchUrls = urls;
  sendLogUpdate = logUpdateFunction;
};

/**
 * Sets the selected model
 * @param {string} model - The model to set as selected
 */
export const setSelectedModel = (model: string): void => {
  selectedModel = model;
  electronLog.info(`Selected model set to: ${selectedModel}`);
};

// Re-export functions from ollama module
export {
  testOllama,
  listOllamaModels,
  checkOllamaServer,
  checkServerReachable,
};
