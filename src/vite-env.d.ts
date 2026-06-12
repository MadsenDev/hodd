/// <reference types="vite/client" />

type HoddDesktopApi = {
  platform: string;
  getState: () => Promise<Record<string, unknown>>;
  saveState: (state: Record<string, unknown>) => Promise<{ savedAt: string }>;
  exportArchive: (payload: Record<string, unknown>) => Promise<{ canceled: boolean; path?: string }>;
};

declare global {
  interface Window {
    hoddDesktop?: HoddDesktopApi;
  }
}

export {};
