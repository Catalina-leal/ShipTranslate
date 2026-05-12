import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import shipmentsRouter from './routes/shipments.js';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  console.log('Recibida petición GET /');
  res.json({ message: 'Tranship backend activo' });
});

app.use('/api/shipments', (req, res, next) => {
  console.log(`Petición a /api/shipments: ${req.method} ${req.path}`);
  next();
}, shipmentsRouter);

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Capturar errores no manejados
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

async function startServer() {
  try {
    console.log('Conectando a MongoDB...');
    await connectDB();
    console.log('MongoDB conectada, iniciando servidor...');
    app.listen(port, () => {
      console.log(`Backend ejecutándose en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
