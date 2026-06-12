import React from 'react';
import ReactDOM from 'react-dom/client';
import HoddApp from './HoddApp';
import './styles.css';
import './desktop.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HoddApp />
  </React.StrictMode>,
);
