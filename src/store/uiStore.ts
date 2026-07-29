import { create } from 'zustand';

export interface UIState {
  isLeftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  setLeftSidebar: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLeftSidebarOpen: true,
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
  setLeftSidebar: (isOpen) => set({ isLeftSidebarOpen: isOpen }),
}));
