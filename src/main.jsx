import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Use Vite's BASE_URL as the router basename so the app can be served under /app/ */}
    <BrowserRouter basename={(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
