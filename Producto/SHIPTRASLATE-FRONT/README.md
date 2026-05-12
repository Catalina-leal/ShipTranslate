"# SHIPTRASLATE-FRONT

Este frontend inicial está construido con React, Vite y React Router.

## Cómo ejecutar

1. Navega a `FRONTEND`
2. Copia `.env.example` a `.env`
3. Ejecuta `npm install`
4. Ejecuta `npm run dev`

Abre el navegador en `http://localhost:5173`.

## Configuración de API

Ajusta `VITE_API_BASE_URL` en el archivo `.env` si tu backend corre en otra dirección.

## Rutas del frontend

- `/` - Página de inicio
- `/shipments` - Lista de envíos
- `/shipments/new` - Crear un nuevo envío

## Características iniciales

- Navegación con React Router
- Formulario para crear un envío
- Lista de envíos recibida desde el backend
- Consumo de API en `src/services/api.js`

## Estructura inicial

- `public/index.html` - Entrada HTML
- `src/index.jsx` - Punto de arranque React
- `src/App.jsx` - Componente principal
- `src/components/ShipmentForm.jsx` - Formulario de envío
- `src/components/ShipmentList.jsx` - Tabla de envíos
- `src/services/api.js` - Cliente HTTP con Axios
- `src/styles.css` - Estilos básicos
" 
