# Proyecto Tranship

Esta solución inicial tiene dos partes:

- `BACKEND` - API en Node.js + Express
- `FRONTEND` - Aplicación web con React y Vite

## Cómo empezar

1. Abrir terminal en `BACKEND` y ejecutar:
   ```bash
   npm install
   npm run dev
   ```
2. Abrir otra terminal en `FRONTEND` y ejecutar:
   ```bash
   npm install
   npm run dev
   ```

## Puertos

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

## Nota

El backend ahora usa MongoDB para guardar los envíos. Copia `BACKEND/.env.example` a `BACKEND/.env` y ajusta `MONGODB_URI` según tu entorno.
