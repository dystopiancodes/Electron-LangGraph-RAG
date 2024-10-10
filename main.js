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

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const Store = require("electron-store");
const log = require("electron-log");
const path = require("path");
const fs = require("fs").promises;

const store = new Store();

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const pdfParsePath = path.join(process.resourcesPath, "pdf-parse");
  const nodeEnsurePath = path.join(process.resourcesPath, "node-ensure");
  const faissNodePath = path.join(process.resourcesPath, "faiss-node");
  require("module").globalPaths.push(
    pdfParsePath,
    nodeEnsurePath,
    faissNodePath
  );
}

// Add this function
function ensureWritePermissions(folderPath) {
  try {
    fs.access(folderPath, fs.constants.W_OK);
    console.log(`Write permissions confirmed for ${folderPath}`);
    log.info(`Write permissions confirmed for ${folderPath}`);
  } catch (err) {
    console.error(`No write permissions for ${folderPath}:`, err);
    log.error(`No write permissions for ${folderPath}:`, err);
    throw new Error(
      `No write permissions for the selected folder: ${folderPath}`
    );
  }
}

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

  // Add this at the top of the file
  const _ = require("lodash");

  // Replace the existing console message event listener with this:
  let lastLogTime = Date.now();
  const throttledConsoleLog = _.throttle((message) => {
    const now = Date.now();
    if (now - lastLogTime > 1000) {
      // Only log once per second
      log.info(`Renderer Console: ${message}`);
      lastLogTime = now;
    }
  }, 1000);

  win.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      throttledConsoleLog(message);
    }
  );
}

app.whenReady().then(async () => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  log.info("App is ready");
  log.info("Electron app version:", app.getVersion());
  log.info("Electron version:", process.versions.electron);
  log.info("Chrome version:", process.versions.chrome);
  log.info("Node version:", process.versions.node);

  logModulePaths();

  const faissNodePath = path.join(process.resourcesPath, "faiss-node");
  log.info("Expected faiss-node path:", faissNodePath);
  log.info("faiss-node exists:", fs.existsSync(faissNodePath));

  if (fs.existsSync(faissNodePath)) {
    const files = fs.readdirSync(faissNodePath);
    log.info("faiss-node directory contents:", files);
  }

  log.info("Process architecture:", process.arch);
  log.info("Process platform:", process.platform);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function sendStepUpdate(step) {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("update-step", step);
  }
}

function sendLogUpdate(step, log) {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("update-log", { step, log });
  }
}

function getTavilyApiKey() {
  return process.env.TAVILY_API_KEY || store.get("tavilyApiKey");
}

ipcMain.handle(
  "invoke-rag",
  async (event, { question, model, embeddingModel, isTavilySearchEnabled }) => {
    try {
      const { runRAG, setSearchUrls } = require("./src/rag");
      const tavilyApiKey = getTavilyApiKey();
      const searchUrls = store.get("searchUrls", []);
      const selectedFolderPath = store.get("selectedFolder");
      setSearchUrls(searchUrls, sendLogUpdate);
      sendStepUpdate("route");
      log.info("Starting RAG pipeline");
      const result = await runRAG(
        question,
        model,
        embeddingModel,
        sendStepUpdate,
        sendLogUpdate,
        tavilyApiKey,
        isTavilySearchEnabled,
        selectedFolderPath
      );
      log.info("RAG process completed. Result:", result);
      return result;
    } catch (error) {
      log.error("Error in invoke-rag handler:", error);
      sendLogUpdate("error", `Error in invoke-rag handler: ${error.message}`);
      return { error: error.message };
    }
  }
);

ipcMain.handle("list-ollama-models", async () => {
  try {
    const { listOllamaModels } = require("./src/rag");
    return await listOllamaModels();
  } catch (error) {
    log.error("Error listing Ollama models:", error);
    return [];
  }
});

ipcMain.handle("list-embedding-models", async () => {
  try {
    const { listEmbeddingModels } = require("./src/rag");
    return await listEmbeddingModels();
  } catch (error) {
    log.error("Error listing embedding models:", error);
    return [];
  }
});

ipcMain.handle("test-ollama", async (event, model) => {
  const { testOllama } = require("./src/rag");
  return await testOllama(model);
});

ipcMain.handle("check-ollama-status", async (event, model) => {
  const { checkOllamaServer } = require("./src/rag");
  return await checkOllamaServer(model);
});

ipcMain.handle("save-tavily-api-key", async (event, apiKey) => {
  store.set("tavilyApiKey", apiKey);
});

ipcMain.handle("get-tavily-api-key", async () => {
  return store.get("tavilyApiKey");
});

ipcMain.handle("save-search-urls", async (event, urls) => {
  store.set("searchUrls", urls);
});

ipcMain.handle("get-search-urls", async () => {
  return store.get("searchUrls", []);
});

ipcMain.handle("save-selected-model", async (event, model) => {
  store.set("selectedModel", model);
});

ipcMain.handle("get-selected-model", async () => {
  return store.get("selectedModel", "");
});

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
    ensureWritePermissions(folderPath);
    const { loadOrCreateVectorStore } = require("./src/rag");
    const sendProgress = (progress) => {
      event.sender.send("indexing-progress", progress);
    };
    const result = await loadOrCreateVectorStore(folderPath, sendProgress);
    log.info("Vector store operation result:", result);
    return result;
  } catch (error) {
    log.error("Error in load-or-create-vector-store handler:", error);
    dialog.showErrorBox("Vector Store Error", error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("set-tavily-search-enabled", (event, isEnabled) => {
  store.set("tavilySearchEnabled", isEnabled);
});

ipcMain.handle("get-tavily-search-enabled", () => {
  return store.get("tavilySearchEnabled", false);
});

ipcMain.handle("save-selected-embedding-model", async (event, model) => {
  store.set("selectedEmbeddingModel", model);
});

ipcMain.handle("get-selected-embedding-model", async () => {
  return store.get("selectedEmbeddingModel", "");
});
