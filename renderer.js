const { ipcRenderer } = require("electron");
const _ = require("lodash");

document.addEventListener("DOMContentLoaded", () => {
  const settingsIcon = document.getElementById("settings-icon");

  settingsIcon.addEventListener("click", () => {
    ipcRenderer.send("open-settings");
  });

  // Update the existing code that loads models
  ipcRenderer
    .invoke("list-ollama-models")
    .then((models) => {
      console.log("Models loaded:", models.join(","));
      // Your existing code to populate the model dropdown
    })
    .catch((error) => {
      console.error("Error loading Ollama models:", error);
      // Handle the error, maybe show a message to the user
    });

  ipcRenderer
    .invoke("get-selected-model")
    .then((model) => {
      console.log("Selected model:", model);
      // Your existing code to set the selected model
    })
    .catch((error) => {
      console.error("Error getting selected model:", error);
      // Handle the error
    });

  // Add similar error handling for other ipcRenderer.invoke calls

  // Replace the existing indexing-progress event listener with this:
  const throttledProgressUpdate = _.throttle((progress) => {
    const loadingStatus = document.getElementById("loadingStatus");
    const loadingProgress = document.getElementById("loadingProgress");

    loadingStatus.textContent = progress.message;

    if (progress.percentage !== undefined) {
      loadingProgress.style.width = `${progress.percentage}%`;
    }

    if (progress.status === "saved") {
      isLoadingFolder = false;
      document
        .getElementById("folderSelectButton")
        .classList.remove("animate-pulse");
      document.getElementById("folderLoadingContainer").classList.add("hidden");
    }
  }, 100); // Update at most every 100ms

  ipcRenderer.on("indexing-progress", (event, progress) => {
    throttledProgressUpdate(progress);
  });
});
