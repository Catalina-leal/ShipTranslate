"# SHIPTRASLATE-BACK

Este backend inicial ofrece una API REST para gestionar envíos.

## Cómo ejecutar

1. Navega a `BACKEND`
2. Copia `.env.example` a `.env` y ajusta la cadena de conexión si es necesario
3. Ejecuta `npm install`
4. Ejecuta `npm run dev`

La API estará disponible en `http://localhost:4000`.

## Base de datos

Este backend usa MongoDB con Mongoose. Ajusta `MONGODB_URI` en el archivo `.env`.

## Endpoints principales

- `GET /api/shipments` - Listar envíos
- `POST /api/shipments` - Crear un envío
- `GET /api/shipments/:id` - Consultar un envío
- `PUT /api/shipments/:id` - Actualizar un envío
- `DELETE /api/shipments/:id` - Eliminar un envío

## Estructura inicial

- `src/index.js` - Servidor Express
- `src/routes/shipments.js` - Rutas de envíos
- `src/controllers/shipmentsController.js` - Controladores de negocio
- `src/models/shipmentModel.js` - Modelo en memoria
- `src/config/db.js` - Configuración de base de datos de ejemplo
" 
