import React from 'react';
import ReactDOM from 'react-dom/client';
import HoddApp from './HoddApp';
import { initializeDesktopPersistence } from './desktopPersistence';
import './styles.css';
import './desktop.css';

async function start() {
  await initializeDesktopPersistence();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HoddApp />
    </React.StrictMode>,
  );
}

void start();
