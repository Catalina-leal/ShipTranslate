import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Cargando variables de entorno desde ${envPath}`);
} else {
  dotenv.config();
  console.warn(
    `No se encontró .env en ${envPath}. Usando variables de entorno del proceso.`
  );
}

import express from 'express';
import cors from 'cors';

import shipmentsRouter from './routes/shipments.js';
import authRouter from './routes/auth.js';
import { connectDB } from './config/db.js';

// Punto de entrada del backend Express.
// Configura middlewares, conecta MongoDB y monta las rutas REST.

/* =========================
   DEBUG ENV
========================= */

console.log(
  'OPENAI_API_KEY:',
  process.env.OPENAI_API_KEY
    ? 'CARGADA ✅'
    : 'NO CARGADA ❌'
);

/* =========================
   APP
========================= */

const app = express();

const port =
  Number(process.env.PORT) || 4000;

/* =========================
   MIDDLEWARES
========================= */

app.use(cors());

// Permite recibir JSON en las peticiones REST.
app.use(express.json({ limit: '5mb' }));

/* =========================
   TEST ROUTE
========================= */

app.get('/', (req, res) => {

  console.log(
    'Recibida petición GET /'
  );

  res.json({
    message:
      'Tranship backend activo',
  });
});

/* =========================
   ROUTES
========================= */

app.use(
  '/api/shipments',

  (req, res, next) => {

    console.log(
      `Petición a /api/shipments: ${req.method} ${req.path}`
    );

    next();
  },

  shipmentsRouter
);

// Rutas de autenticacion, login y solicitudes administrativas.
app.use(
  '/api/auth',

  (req, res, next) => {

    console.log(
      `Petición a /api/auth: ${req.method} ${req.path}`
    );

    next();
  },

  authRouter
);

/* =========================
   ERROR HANDLER
========================= */

app.use(
  (err, req, res, next) => {

    console.error(
      'Error en el servidor:',
      err
    );

    const statusCode = err.status || err.statusCode || 500;

    res.status(statusCode).json({
      message:
        statusCode === 413
          ? 'La informacion enviada es demasiado grande'
          : 'Error interno del servidor',
    });
  }
);

/* =========================
   PROCESS ERRORS
========================= */

process.on(
  'uncaughtException',
  (err) => {

    console.error(
      'Uncaught Exception:',
      err
    );

    process.exit(1);
  }
);

process.on(
  'unhandledRejection',
  (reason, promise) => {

    console.error(
      'Unhandled Rejection at:',
      promise,
      'reason:',
      reason
    );

    process.exit(1);
  }
);

/* =========================
   SERVER
========================= */

function listenPort(currentPort) {

  return new Promise(
    (resolve, reject) => {

      const server =
        app.listen(currentPort)

          .once(
            'listening',
            () => {

              console.log(
                `Backend ejecutándose en http://localhost:${currentPort}`
              );

              resolve(server);
            }
          )

          .once(
            'error',
            (error) => {

              if (
                error.code ===
                'EADDRINUSE'
              ) {

                const nextPort =
                  Number(currentPort) + 1;

                console.warn(
                  `Puerto ${currentPort} en uso, intentando con ${nextPort}`
                );

                resolve(
                  listenPort(nextPort)
                );

              } else {

                reject(error);
              }
            }
          );
    }
  );
}

/* =========================
   START SERVER
========================= */

async function startServer() {

  try {

    console.log(
      'Conectando a MongoDB...'
    );

    await connectDB();

    console.log(
      'MongoDB conectada, iniciando servidor...'
    );

    await listenPort(port);

  } catch (error) {

    console.error(
      'Error al iniciar servidor:',
      error
    );

    process.exit(1);
  }
}

startServer();
