import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as electronLog from "electron-log";
import * as dotenv from "dotenv";
import {
  runRAG,
  checkOllamaServer,
  testOllama,
  listOllamaModels,
  checkServerReachable,
} from "../rag/index";

// Load environment variables
dotenv.config();

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../../public/index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// Create window when Electron has finished initialization
app.on("ready", createWindow);

// Quit the application when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// On macOS, re-create a window when dock icon is clicked and no other windows are open
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle("check-ollama-server", async (event, model) => {
  electronLog.info(
    `Received request to check Ollama server for model: ${model}`
  );

  const isReachable = await checkServerReachable();
  if (!isReachable) {
    electronLog.error("Ollama server is not reachable");
    return false;
  }

  const result = await checkOllamaServer(model);
  electronLog.info(`Check Ollama server result: ${result}`);
  return result;
});

ipcMain.handle("test-ollama", async (event, model) => {
  electronLog.info(`Received request to test Ollama with model: ${model}`);
  const result = await testOllama(model);
  electronLog.info(`Test Ollama result: ${result}`);
  return result;
});

ipcMain.handle("list-ollama-models", async () => {
  electronLog.info("Received request to list Ollama models");
  const models = await listOllamaModels();
  electronLog.info(`Listed Ollama models: ${JSON.stringify(models)}`);
  return models;
});

electronLog.info("Application started");
