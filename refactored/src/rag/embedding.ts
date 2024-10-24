import * as electronLog from "electron-log";

/**
 * Mocks the embedding process for a document
 * @param {string} document - The document to embed
 * @returns {Promise<number[]>} Mocked embedding vector
 */
export const mockEmbedDocument = async (
  document: string
): Promise<number[]> => {
  electronLog.info(`Mock: Embedding document: ${document}`);
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Return a mock embedding vector
  return Array(128)
    .fill(0)
    .map(() => Math.random());
};
