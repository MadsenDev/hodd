// Lightweight toast event bus — no React dependency, so api.ts can emit from the data layer.

export type ToastKind = 'error' | 'success' | 'info';
export interface Toast { id: number; kind: ToastKind; message: string; }

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();
let seq = 0;

export const toaster = {
  on(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(kind: ToastKind, message: string): void {
    const t: Toast = { id: ++seq, kind, message };
    listeners.forEach(fn => fn(t));
  },
  error(message: string): void { this.emit('error', message); },
  success(message: string): void { this.emit('success', message); },
  info(message: string): void { this.emit('info', message); },
};
