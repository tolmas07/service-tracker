import { create } from 'zustand';

interface ManagerState {
  selectedWorker: string;
  setSelectedWorker: (id: string) => void;
}

export const useManagerStore = create<ManagerState>((set) => ({
  selectedWorker: 'all',
  setSelectedWorker: (id) => set({ selectedWorker: id }),
}));
