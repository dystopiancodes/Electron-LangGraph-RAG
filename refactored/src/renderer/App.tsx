import React, { useState, useEffect } from "react";
import { ipcRenderer } from "electron";
import Header from "./components/Header";
import FileUpload from "./components/FileUpload";
import ChatMessages from "./components/ChatMessages";
import QuestionInput from "./components/QuestionInput";
import { ServiceFactory } from "../services/serviceFactory";
import { LLMService, EmbeddingService } from "../services/interfaces";

const App: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<string>("");
  const [ollamaTestResult, setOllamaTestResult] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    "llama3.2:3b-instruct-fp16"
  );
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>("");
  const [messages, setMessages] = useState<
    Array<{ type: "user" | "system"; text: string }>
  >([]);

  const llmService: LLMService = ServiceFactory.getLLMService("ollama");
  const embeddingService: EmbeddingService =
    ServiceFactory.getEmbeddingService("ollama");

  useEffect(() => {
    checkServer();
    listModels();
  }, []);

  const checkServer = async () => {
    const result = await llmService.checkServerStatus(selectedModel);
    setServerStatus(result ? "Running" : "Not running");
  };

  const testOllama = async () => {
    const result = await llmService.testModel(selectedModel);
    setOllamaTestResult(result ? "Test passed" : "Test failed");
  };

  const listModels = async () => {
    const models = await llmService.listModels();
    setAvailableModels(models);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles([...files, ...droppedFiles]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;

    setMessages([...messages, { type: "user", text: question }]);
    const response = await llmService.generateResponse(question);
    setMessages((prev) => [...prev, { type: "system", text: response }]);
    setQuestion("");
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Header selectedModel={selectedModel} />
        <FileUpload
          isDragging={isDragging}
          handleDrop={handleDrop}
          handleFileInput={handleFileInput}
        />
        <ChatMessages messages={messages} />
        <QuestionInput
          question={question}
          setQuestion={setQuestion}
          askQuestion={askQuestion}
        />
      </div>
    </div>
  );
};

export default App;
