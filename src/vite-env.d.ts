/// <reference types="vite/client" />

type OllamaApi = {
  status: () => Promise<{ running: boolean; models: string[] }>;
  chat: (model: string, messages: { role: string; content: string }[]) => Promise<string>;
  generate: (model: string, prompt: string, system?: string) => Promise<string>;
  checkInstalled: () => Promise<{ installed: boolean }>;
  install: () => Promise<void>;
  cancelInstall: () => Promise<void>;
  start: () => Promise<{ ok: boolean; error?: string }>;
  pullModel: (name: string) => Promise<{ ok: boolean; error?: string }>;
  stop: () => Promise<void>;
  onStream: (cb: (data: { type: string; data: string }) => void) => void;
  offStream: () => void;
  onPullProgress: (cb: (data: { status: string; pct: number | null }) => void) => void;
  offPullProgress: () => void;
};

type HoddDesktopApi = {
  platform: string;
  exportArchive: (payload: Record<string, unknown>) => Promise<{ canceled: boolean; path?: string }>;
  importArchive: () => Promise<{ canceled: boolean; imported?: number }>;
  setTitleBarTheme: (theme: 'light' | 'dark') => Promise<void>;
  api: Record<string, (...args: unknown[]) => Promise<unknown>>;
  ollama: OllamaApi;
};

declare global {
  interface Window {
    hoddDesktop?: HoddDesktopApi;
  }
}

export {};
