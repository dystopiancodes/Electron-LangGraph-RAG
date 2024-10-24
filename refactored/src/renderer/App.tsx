import React, { useState } from "react";
import { ipcRenderer } from "electron";

const App: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<string>("");
  const [ollamaTestResult, setOllamaTestResult] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const checkServer = async () => {
    const result = await ipcRenderer.invoke(
      "check-ollama-server",
      "llama3.2:3b-instruct-fp16"
    );
    setServerStatus(result ? "Running" : "Not running");
  };

  const testOllama = async () => {
    const result = await ipcRenderer.invoke(
      "test-ollama",
      "llama3.2:3b-instruct-fp16"
    );
    setOllamaTestResult(result ? "Test passed" : "Test failed");
  };

  const listModels = async () => {
    const models = await ipcRenderer.invoke("list-ollama-models");
    setAvailableModels(models);
  };

  return (
    <div>
      <h1>RAG Application</h1>
      <button onClick={checkServer}>Check Ollama Server</button>
      <p>Server status: {serverStatus}</p>
      <button onClick={testOllama}>Test Ollama</button>
      <p>Ollama test result: {ollamaTestResult}</p>
      <button onClick={listModels}>List Ollama Models</button>
      <ul>
        {availableModels.map((model, index) => (
          <li key={index}>{model}</li>
        ))}
      </ul>
    </div>
  );
};

export default App;
