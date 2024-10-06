const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
  const settingsIcon = document.getElementById("settings-icon");

  settingsIcon.addEventListener("click", () => {
    ipcRenderer.send("open-settings");
  });

  // ... rest of your existing renderer code
});
