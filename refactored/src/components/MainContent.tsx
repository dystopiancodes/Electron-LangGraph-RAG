import React from "react";
import FileUpload from "./FileUpload";
import ProgressBar from "./ProgressBar";
import ChatMessages from "./ChatMessages";
import QuestionInput from "./QuestionInput";
import { useStore } from "../store";

interface MainContentProps {
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  askQuestion: () => Promise<void>;
}

const MainContent: React.FC<MainContentProps> = ({
  handleDrop,
  handleFileInput,
  askQuestion,
}) => {
  const { isDragging, question, messages, currentStep, steps, setQuestion } =
    useStore();

  return (
    <>
      <div className="p-6">
        <FileUpload
          isDragging={isDragging}
          handleDrop={handleDrop}
          handleFileInput={handleFileInput}
        />
        <ProgressBar steps={steps} currentStep={currentStep} />
      </div>
      <div className="flex-1 overflow-auto px-6">
        <ChatMessages messages={messages} />
      </div>
      <div className="p-6">
        <QuestionInput
          question={question}
          setQuestion={setQuestion}
          askQuestion={askQuestion}
        />
      </div>
    </>
  );
};

export default MainContent;
