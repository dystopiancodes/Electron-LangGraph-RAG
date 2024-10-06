require("dotenv").config();
const {
  ReadableStream,
  WritableStream,
  TransformStream,
} = require("web-streams-polyfill");
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Add these lines to provide fetch polyfill
const nodeFetch = require("node-fetch");
global.fetch = nodeFetch;
global.Headers = nodeFetch.Headers;
global.Request = nodeFetch.Request;
global.Response = nodeFetch.Response;

// Update this line to use the correct import
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest = XMLHttpRequest;

const { app, BrowserWindow, ipcMain } = require("electron");
const Store = require("electron-store");

const store = new Store();

// Remove this line
// const { checkOllamaServer } = require("./src/rag");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(async () => {
  // Remove the Ollama server check
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Add this function to send step updates
function sendStepUpdate(step) {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("update-step", step);
  }
}

// Add this function to send log updates
function sendLogUpdate(step, log) {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("update-log", { step, log });
  }
}

// Update the invoke-rag handler
ipcMain.handle(
  "invoke-rag",
  async (event, { question, model, isTavilySearchEnabled }) => {
    try {
      const { runRAG, setSearchUrls } = require("./src/rag");
      const tavilyApiKey = store.get("tavilyApiKey");
      const searchUrls = store.get("searchUrls", []);
      const selectedFolderPath = store.get("selectedFolder");
      setSearchUrls(searchUrls, sendLogUpdate);
      sendStepUpdate("route");
      console.log(
        "Starting RAG process with question:",
        question,
        "model:",
        model,
        "Tavily search enabled:",
        isTavilySearchEnabled
      );
      const result = await runRAG(
        question,
        model,
        sendStepUpdate,
        sendLogUpdate,
        tavilyApiKey,
        isTavilySearchEnabled,
        selectedFolderPath
      );
      console.log("RAG process completed. Result:", result);
      return result;
    } catch (error) {
      console.error("Error in invoke-rag handler:", error);
      sendLogUpdate("error", `Error in invoke-rag handler: ${error.message}`);
      return { error: error.message };
    }
  }
);

// Update this handler for test-ollama
ipcMain.handle("test-ollama", async (event, model) => {
  const { testOllama } = require("./src/rag");
  return await testOllama(model);
});

// Update this handler for checking Ollama status
ipcMain.handle("check-ollama-status", async (event, model) => {
  const { checkOllamaServer } = require("./src/rag");
  return await checkOllamaServer(model);
});

// Add this new IPC handler
ipcMain.handle("list-ollama-models", async () => {
  const { listOllamaModels } = require("./src/rag");
  return await listOllamaModels();
});

// Add these new IPC handlers
ipcMain.handle("save-tavily-api-key", async (event, apiKey) => {
  store.set("tavilyApiKey", apiKey);
});

ipcMain.handle("get-tavily-api-key", async () => {
  return store.get("tavilyApiKey");
});

// Add these new IPC handlers
ipcMain.handle("save-search-urls", async (event, urls) => {
  store.set("searchUrls", urls);
});

ipcMain.handle("get-search-urls", async () => {
  return store.get("searchUrls", []); // Return an empty array if no URLs are saved
});

// Add these new IPC handlers
ipcMain.handle("save-selected-model", async (event, model) => {
  store.set("selectedModel", model);
});

ipcMain.handle("get-selected-model", async () => {
  return store.get("selectedModel", "");
});

// Add folder selection and vector store management handlers
const { dialog } = require("electron");
const fs = require("fs").promises;

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (!result.canceled) {
    const folderPath = result.filePaths[0];
    store.set("selectedFolder", folderPath);
    return folderPath;
  }
  return null;
});

ipcMain.handle("get-selected-folder", () => {
  return store.get("selectedFolder", null);
});

ipcMain.handle("load-or-create-vector-store", async (event, folderPath) => {
  try {
    const { loadOrCreateVectorStore } = require("./src/rag");
    const sendProgress = (progress) => {
      event.sender.send("indexing-progress", progress);
    };
    const result = await loadOrCreateVectorStore(folderPath, sendProgress);
    console.log("Vector store operation result:", result);
    return result;
  } catch (error) {
    console.error("Error in load-or-create-vector-store handler:", error);
    return { success: false, error: error.message };
  }
});

// Add this new IPC handler
ipcMain.handle("set-tavily-search-enabled", (event, isEnabled) => {
  store.set("tavilySearchEnabled", isEnabled);
});

// Add this handler near the other IPC handlers
ipcMain.handle("get-tavily-search-enabled", () => {
  return store.get("tavilySearchEnabled", false);
});
