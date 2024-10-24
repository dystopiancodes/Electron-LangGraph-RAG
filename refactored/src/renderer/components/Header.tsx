import React from "react";

interface HeaderProps {
  selectedModel: string;
}

const Header: React.FC<HeaderProps> = ({ selectedModel }) => (
  <div className="md:flex md:items-center md:justify-between mb-8">
    <div className="min-w-0">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
        RAGent-α (ver1.0)
      </h2>
    </div>
    <div className="mt-4 flex items-center gap-2 md:mt-0">
      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
        {selectedModel}
      </span>
    </div>
  </div>
);

export default Header;
