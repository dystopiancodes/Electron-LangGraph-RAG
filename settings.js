const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
  const tavilyApiKeyInput = document.getElementById("tavily-api-key");
  const searchUrlsTextarea = document.getElementById("search-urls");
  const selectedModelSelect = document.getElementById("selected-model");
  const saveButton = document.getElementById("save-settings");

  // Load current settings
  ipcRenderer.invoke("get-tavily-api-key").then((apiKey) => {
    tavilyApiKeyInput.value = apiKey || "";
  });

  ipcRenderer.invoke("get-search-urls").then((urls) => {
    searchUrlsTextarea.value = urls.join("\n");
  });

  ipcRenderer.invoke("get-selected-model").then((model) => {
    selectedModelSelect.value = model || "";
  });

  ipcRenderer.invoke("list-ollama-models").then((models) => {
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      selectedModelSelect.appendChild(option);
    });
  });

  // Save settings
  saveButton.addEventListener("click", () => {
    const apiKey = tavilyApiKeyInput.value;
    const urls = searchUrlsTextarea.value
      .split("\n")
      .filter((url) => url.trim() !== "");
    const selectedModel = selectedModelSelect.value;

    ipcRenderer.invoke("save-tavily-api-key", apiKey);
    ipcRenderer.invoke("save-search-urls", urls);
    ipcRenderer.invoke("save-selected-model", selectedModel);

    alert("Settings saved successfully!");
  });
});
