import mongoose from 'mongoose';

// Modelo de usuarios del sistema.
// Define las cuentas que pueden iniciar sesion y el rol que controla sus vistas.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Roles disponibles: admin administra solicitudes/historico; user usa el flujo EDI.
    role: {
      type: String,
      enum: ['admin', 'user'],
      required: true,
    },
    // Permite bloquear cuentas o dejarlas pendientes sin eliminar el usuario.
    status: {
      type: String,
      enum: ['active', 'pending', 'disabled'],
      default: 'active',
    },
    // La contrasena no se guarda en texto plano: se almacena hash + salt.
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

const User = mongoose.model('User', userSchema);

export default User;
