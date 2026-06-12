# HODD Desktop

**Your hoard. Your story.** HODD is a local-first desktop collection companion built from the supplied design archive.

## Stack

- Electron desktop shell with a hardened context-isolated preload bridge
- Vite + React + TypeScript renderer
- Local JSON persistence through Electron IPC, with the supplied normalized catalog data as the seed backend
- Responsive collection-first interface based directly on the bundled HODD design system

## Development

```bash
npm install
npm run dev
```

## Checks and packaging

```bash
npm run typecheck
npm test
npm run build
npm run package
```

The production build is written to `dist/` and Electron's compiled main/preload processes to `dist-electron/`.
