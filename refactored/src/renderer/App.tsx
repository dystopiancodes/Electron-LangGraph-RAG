import React, { useEffect } from "react";
import Layout from "../components/Layout";
import MainContent from "../components/MainContent";
import { useStore } from "../store";
import { useDragAndDrop } from "../hooks/useDragAndDrop";
import { mockEmbedDocument } from "../rag/embedding";

const App: React.FC = () => {
  const {
    selectedModel,
    question,
    currentStep,
    steps,
    setServerStatus,
    setAvailableModels,
    addMessage,
    setQuestion,
    setCurrentStep,
    initializeServices,
    llmService,
  } = useStore();

  const {
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInput,
    isSidebarOpen,
    toggleSidebar,
  } = useDragAndDrop();

  useEffect(() => {
    initializeServices("ollama", "ollama");
  }, [initializeServices]);

  useEffect(() => {
    if (llmService) {
      checkServer();
      listModels();
    }
  }, [llmService]);

  const checkServer = async () => {
    if (llmService) {
      const result = await llmService.checkServerStatus(selectedModel);
      setServerStatus(result ? "Running" : "Not running");
    }
  };

  const listModels = async () => {
    if (llmService) {
      const models = await llmService.listModels();
      setAvailableModels(models);
    }
  };

  const askQuestion = async () => {
    if (!question.trim() || !llmService) return;

    addMessage({ type: "user", text: question });
    setCurrentStep(0);

    // Simulate RAG process steps
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing time
    }

    // Mock embedding
    const embedding = await mockEmbedDocument(question);
    console.log("Mock embedding vector:", embedding);

    const response = await llmService.generateResponse(question);
    addMessage({ type: "system", text: response });
    setQuestion("");
    setCurrentStep(0);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <Layout
        selectedModel={selectedModel}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      >
        <MainContent
          handleDrop={handleDrop}
          handleFileInput={handleFileInput}
          askQuestion={askQuestion}
        />
      </Layout>
    </div>
  );
};

export default App;
