import mongoose from 'mongoose';

// Modelo para solicitudes administrativas.
// Guarda peticiones de crear cuenta o recuperar acceso para que el admin las revise.
const accessRequestSchema = new mongoose.Schema(
  {
    // Tipo de solicitud enviada desde el frontend.
    type: {
      type: String,
      enum: ['create-account', 'recover-access'],
      required: true,
    },
    // Estado de revision: pendiente, aprobada, rechazada o finalizada.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'finalized'],
      default: 'pending',
    },
    name: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    company: { type: String },
    role: { type: String },
    reason: { type: String },
    details: { type: String },
  },
  {
    timestamps: true,
    collection: 'accessrequests',
  }
);

const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

export default AccessRequest;
