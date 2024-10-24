import React, { useState, useEffect } from "react";
import { useStore } from "../store";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { files, removeFile } = useStore();
  const [loadingProgress, setLoadingProgress] = useState<Map<string, number>>(
    new Map()
  );

  useEffect(() => {
    // Initialize loading progress for new files
    files.forEach((fileWithEmbedding) => {
      if (!loadingProgress.has(fileWithEmbedding.file.name)) {
        setLoadingProgress((prev) =>
          new Map(prev).set(fileWithEmbedding.file.name, 100)
        );
      }
    });
  }, [files]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleRemoveFile = (index: number) => {
    const fileName = files[index].file.name;
    removeFile(index);
    setLoadingProgress((prev) => {
      const newProgress = new Map(prev);
      newProgress.delete(fileName);
      return newProgress;
    });
  };

  return (
    <div
      className={`w-80 h-screen bg-white border-r border-gray-200 fixed left-0 top-0 overflow-y-auto transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Uploaded Files</h3>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5 text-gray-500"
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
        </div>
        <div className="space-y-2">
          {files.map((fileWithEmbedding, index) => {
            const progress =
              loadingProgress.get(fileWithEmbedding.file.name) || 0;
            return (
              <div
                key={index}
                className={`flex flex-col p-3 bg-gray-50 rounded-lg ${
                  progress < 100 ? "opacity-50" : "opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {fileWithEmbedding.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileWithEmbedding.file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
                {progress < 100 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
