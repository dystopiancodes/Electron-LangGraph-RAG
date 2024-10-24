import { create } from "zustand";
import { UISlice, createUISlice } from "./slices/uiSlice";
import { FileSlice, createFileSlice } from "./slices/fileSlice";
import { ChatSlice, createChatSlice } from "./slices/chatSlice";
import { ServiceSlice, createServiceSlice } from "./slices/serviceSlice";

// Combine all slices to create the full store state
export type StoreState = UISlice & FileSlice & ChatSlice & ServiceSlice;

// Create the store with all slices
export const useStore = create<StoreState>()((...a) => ({
  ...createUISlice(...a),
  ...createFileSlice(...a),
  ...createChatSlice(...a),
  ...createServiceSlice(...a),
}));
