import { useState, useCallback } from "react";
import { useStore } from "../store";

export const useDragAndDrop = () => {
  const { addFile, files } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const isFileDuplicate = useCallback(
    (file: File) => {
      return files.some(
        (f) => f.file.name === file.name && f.file.size === file.size
      );
    },
    [files]
  );

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      const uniqueFiles = newFiles.filter((file) => !isFileDuplicate(file));
      for (const file of uniqueFiles) {
        await addFile(file);
      }
      if (uniqueFiles.length > 0) {
        setIsSidebarOpen(true);
      }
    },
    [addFile, isFileDuplicate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "application/pdf"
      );
      handleFiles(droppedFiles);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const newFiles = Array.from(e.target.files).filter(
          (file) => file.type === "application/pdf"
        );
        handleFiles(newFiles);
      }
    },
    [handleFiles]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return {
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInput,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    isDragging,
  };
};
