import { ipcRenderer } from "electron";

document.addEventListener("DOMContentLoaded", () => {
  const checkServerButton = document.getElementById("checkServer");
  const testOllamaButton = document.getElementById("testOllama");
  const listModelsButton = document.getElementById("listModels");

  if (checkServerButton) {
    checkServerButton.addEventListener("click", async () => {
      const result = await ipcRenderer.invoke("check-ollama-server", "llama2");
      console.log("Server check result:", result);
    });
  }

  if (testOllamaButton) {
    testOllamaButton.addEventListener("click", async () => {
      const result = await ipcRenderer.invoke("test-ollama", "llama2");
      console.log("Ollama test result:", result);
    });
  }

  if (listModelsButton) {
    listModelsButton.addEventListener("click", async () => {
      const models = await ipcRenderer.invoke("list-ollama-models");
      console.log("Available models:", models);
    });
  }
});
