import React from 'react';

import ReactDOM from 'react-dom/client';

import App from './App.jsx';

import './styles.css';

// Punto de entrada del frontend React.
// Monta la aplicacion completa dentro del div #root de index.html.
ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
