import React from "react";

interface FileUploadProps {
  isDragging: boolean;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  isDragging,
  handleDrop,
  handleFileInput,
}) => (
  <div
    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg ${
      isDragging ? "border-blue-500 bg-blue-50" : ""
    }`}
    onDragEnter={() => {}}
    onDragLeave={() => {}}
    onDragOver={(e) => e.preventDefault()}
    onDrop={handleDrop}
  >
    <div className="space-y-1 text-center">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        stroke="currentColor"
        fill="none"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex text-sm text-gray-600">
        <label
          htmlFor="file-upload"
          className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500"
        >
          <span>Upload files</span>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            onChange={handleFileInput}
            multiple
          />
        </label>
        <p className="pl-1">or drag and drop</p>
      </div>
      <p className="text-xs text-gray-500">PDF, DOC, DOCX or TXT up to 10MB</p>
    </div>
  </div>
);

export default FileUpload;
