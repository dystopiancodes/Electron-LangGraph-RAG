import React from "react";

interface HeaderProps {
  selectedModel: string;
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ selectedModel, toggleSidebar }) => (
  <div className="bg-white shadow-sm">
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="mr-4 p-2 rounded-md hover:bg-gray-100"
        >
          <svg
            className="w-6 h-6 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">RAGent-α (ver1.0)</h1>
      </div>
      <div className="flex items-center">
        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          {selectedModel}
        </span>
      </div>
    </div>
  </div>
);

export default Header;
