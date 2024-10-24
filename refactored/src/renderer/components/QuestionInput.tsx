import React from "react";

interface QuestionInputProps {
  question: string;
  setQuestion: (question: string) => void;
  askQuestion: () => void;
}

const QuestionInput: React.FC<QuestionInputProps> = ({
  question,
  setQuestion,
  askQuestion,
}) => (
  <div className="bg-white shadow rounded-lg">
    <div className="px-4 py-5 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <label
          htmlFor="question"
          className="block text-sm font-medium text-gray-700"
        >
          Ask a question about your documents
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="What would you like to know?"
          />
          <button
            onClick={askQuestion}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default QuestionInput;
