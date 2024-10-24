import { StateCreator } from "zustand";

export interface UISlice {
  isDragging: boolean;
  currentStep: number;
  steps: string[];
  setIsDragging: (isDragging: boolean) => void;
  setCurrentStep: (step: number) => void;
}

// Create the UI slice of the store
export const createUISlice: StateCreator<UISlice> = (set) => ({
  isDragging: false,
  currentStep: 0,
  steps: ["Transforming", "Retrieving", "Grading", "Generating"],
  // Update the dragging state
  setIsDragging: (isDragging) => set({ isDragging }),
  // Update the current step of the RAG process
  setCurrentStep: (step) => set({ currentStep: step }),
});
