import mongoose from 'mongoose';

// Centraliza la conexion a MongoDB para que el resto del backend no repita
// configuracion. Usa MONGODB_URI desde .env.
export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tranship';

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB conectada correctamente');
  } catch (error) {
    console.error('Error conectando con MongoDB:', error.message);
    process.exit(1);
  }
}
