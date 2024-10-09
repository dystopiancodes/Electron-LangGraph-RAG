const { ipcRenderer } = require("electron");

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
});
