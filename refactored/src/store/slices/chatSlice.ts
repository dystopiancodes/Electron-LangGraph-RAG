import { StateCreator } from "zustand";

export interface ChatSlice {
  question: string;
  messages: Array<{ type: "user" | "system"; text: string }>;
  setQuestion: (question: string) => void;
  addMessage: (message: { type: "user" | "system"; text: string }) => void;
}

// Create the chat management slice of the store
export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  question: "",
  messages: [],
  // Update the current question
  setQuestion: (question) => set({ question }),
  // Add a new message to the chat history
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
});
